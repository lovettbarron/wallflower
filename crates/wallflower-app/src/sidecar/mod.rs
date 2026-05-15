pub mod grpc_client;

use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use tracing::info;

const MAX_RESTARTS: u32 = 3;
const STARTUP_TIMEOUT_MS: u64 = 30000;

#[derive(Debug, Clone)]
pub enum SidecarMode {
    Dev { project_dir: PathBuf },
    Bundled { venv_dir: PathBuf },
}

pub struct SidecarManager {
    process: Option<Child>,
    port: u16,
    restart_count: u32,
    mode: SidecarMode,
}

impl SidecarManager {
    pub fn new(port: u16, mode: SidecarMode) -> Self {
        Self {
            process: None,
            port,
            restart_count: 0,
            mode,
        }
    }

    pub async fn ensure_running(&mut self) -> anyhow::Result<u16> {
        if self.is_process_alive() {
            return Ok(self.port);
        }
        if self.restart_count >= MAX_RESTARTS {
            anyhow::bail!("Sidecar exceeded max restarts ({})", MAX_RESTARTS);
        }
        self.spawn().await?;
        Ok(self.port)
    }

    async fn spawn(&mut self) -> anyhow::Result<()> {
        self.kill();

        info!("Spawning analysis sidecar on port {} ({:?})", self.port, self.mode);

        let child = match &self.mode {
            SidecarMode::Dev { project_dir } => {
                if !project_dir.exists() {
                    anyhow::bail!(
                        "Sidecar project directory not found: {}. Set WALLFLOWER_SIDECAR_DIR env var.",
                        project_dir.display()
                    );
                }
                Command::new("uv")
                    .args([
                        "run",
                        "--project",
                        &project_dir.to_string_lossy(),
                        "python",
                        "-m",
                        "wallflower_sidecar",
                        "--port",
                        &self.port.to_string(),
                    ])
                    .stdout(Stdio::piped())
                    .stderr(Stdio::piped())
                    .spawn()?
            }
            SidecarMode::Bundled { venv_dir } => {
                let python_bin = venv_dir.join("bin").join("python");
                if !python_bin.exists() {
                    anyhow::bail!(
                        "Bundled Python not found at: {}. Run analysis setup or reinstall the app.",
                        python_bin.display()
                    );
                }
                Command::new(&python_bin)
                    .args([
                        "-m",
                        "wallflower_sidecar",
                        "--port",
                        &self.port.to_string(),
                    ])
                    .stdout(Stdio::piped())
                    .stderr(Stdio::piped())
                    .spawn()?
            }
        };

        self.process = Some(child);
        self.restart_count += 1;

        self.wait_for_healthy().await?;
        info!("Analysis sidecar is healthy on port {}", self.port);
        Ok(())
    }

    async fn wait_for_healthy(&self) -> anyhow::Result<()> {
        let deadline =
            tokio::time::Instant::now() + tokio::time::Duration::from_millis(STARTUP_TIMEOUT_MS);
        loop {
            if tokio::time::Instant::now() > deadline {
                anyhow::bail!(
                    "Sidecar failed to become healthy within {}ms",
                    STARTUP_TIMEOUT_MS
                );
            }
            match grpc_client::check_health(self.port).await {
                Ok(true) => return Ok(()),
                _ => tokio::time::sleep(tokio::time::Duration::from_millis(500)).await,
            }
        }
    }

    fn is_process_alive(&mut self) -> bool {
        if let Some(ref mut child) = self.process {
            match child.try_wait() {
                Ok(None) => true,
                Ok(Some(_)) => {
                    self.process = None;
                    false
                }
                Err(_) => false,
            }
        } else {
            false
        }
    }

    pub fn reset_restart_count(&mut self) {
        self.restart_count = 0;
    }

    pub fn kill(&mut self) {
        if let Some(ref mut child) = self.process {
            let _ = child.kill();
            let _ = child.wait();
        }
        self.process = None;
    }

    pub fn restart_count(&self) -> u32 {
        self.restart_count
    }
}

impl Drop for SidecarManager {
    fn drop(&mut self) {
        self.kill();
    }
}

/// Resolve how the sidecar should be launched.
/// Priority:
///   1. WALLFLOWER_SIDECAR_DIR env var -> Dev mode
///   2. app_data_dir/sidecar-venv -> Bundled mode (provisioned on first run)
///   3. CARGO_MANIFEST_DIR/../../sidecar -> Dev mode (cargo tauri dev)
pub fn resolve_sidecar_mode(app_handle: Option<&tauri::AppHandle>) -> SidecarMode {
    if let Ok(dir) = std::env::var("WALLFLOWER_SIDECAR_DIR") {
        return SidecarMode::Dev {
            project_dir: PathBuf::from(dir),
        };
    }

    if let Some(handle) = app_handle {
        use tauri::Manager;
        if let Ok(app_data) = handle.path().app_data_dir() {
            let venv_dir = app_data.join("sidecar-venv");
            let python_bin = venv_dir.join("bin").join("python");
            if python_bin.exists() {
                return SidecarMode::Bundled { venv_dir };
            }
        }
        // Check if bundled resources exist (indicates production build)
        if let Ok(resource_dir) = handle.path().resource_dir() {
            let uv_bin = resource_dir.join("sidecar-bundle").join("uv");
            if uv_bin.exists() {
                // Production build but venv not yet provisioned — return bundled mode
                // with the target venv dir (provisioning will create it)
                if let Ok(app_data) = handle.path().app_data_dir() {
                    return SidecarMode::Bundled {
                        venv_dir: app_data.join("sidecar-venv"),
                    };
                }
            }
        }
    }

    let manifest_dir = env!("CARGO_MANIFEST_DIR");
    let dev_path = PathBuf::from(manifest_dir).join("../../sidecar");
    SidecarMode::Dev {
        project_dir: dev_path.canonicalize().unwrap_or(dev_path),
    }
}

/// Provision the Python venv on first run using the bundled uv binary.
/// This downloads Python 3.13 and installs all sidecar dependencies.
pub async fn provision_venv(app: &tauri::AppHandle) -> anyhow::Result<()> {
    use tauri::{Emitter, Manager};

    let resource_dir = app
        .path()
        .resource_dir()
        .map_err(|e| anyhow::anyhow!("Failed to get resource dir: {}", e))?;
    let app_data = app
        .path()
        .app_data_dir()
        .map_err(|e| anyhow::anyhow!("Failed to get app data dir: {}", e))?;

    std::fs::create_dir_all(&app_data)?;

    let uv_bin = resource_dir.join("sidecar-bundle").join("uv");
    let sidecar_tarball = resource_dir.join("sidecar-bundle").join("sidecar.tar.gz");
    let sidecar_src = app_data.join("sidecar-src");
    let venv_dir = app_data.join("sidecar-venv");
    let python_install_dir = app_data.join("python");

    if !uv_bin.exists() {
        anyhow::bail!(
            "Bundled uv binary not found at: {}. App bundle may be incomplete.",
            uv_bin.display()
        );
    }

    // Ensure uv is executable (Tauri may strip permissions during bundling)
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let mut perms = std::fs::metadata(&uv_bin)?.permissions();
        perms.set_mode(0o755);
        std::fs::set_permissions(&uv_bin, perms)?;
    }

    // Extract sidecar source from bundled tarball
    if sidecar_tarball.exists() {
        info!("Extracting sidecar source to {}", sidecar_src.display());
        let _ = std::fs::remove_dir_all(&sidecar_src);
        std::fs::create_dir_all(&sidecar_src)?;
        let output = std::process::Command::new("tar")
            .args(["xzf", &sidecar_tarball.to_string_lossy(), "-C", &sidecar_src.to_string_lossy()])
            .output()?;
        if !output.status.success() {
            anyhow::bail!("Failed to extract sidecar tarball: {}", String::from_utf8_lossy(&output.stderr));
        }
    } else {
        anyhow::bail!("Bundled sidecar.tar.gz not found at: {}", sidecar_tarball.display());
    }

    info!("Provisioning sidecar venv at {}", venv_dir.display());
    let _ = app.emit("sidecar-provision-progress", serde_json::json!({
        "status": "creating_environment",
        "message": "Downloading Python and creating environment..."
    }));

    let output = tokio::process::Command::new(&uv_bin)
        .args([
            "venv",
            "--python",
            "3.13",
            "--relocatable",
            &venv_dir.to_string_lossy(),
        ])
        .env("UV_PYTHON_INSTALL_DIR", &python_install_dir)
        .output()
        .await?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        anyhow::bail!("Failed to create venv: {}", stderr);
    }

    info!("Venv created, installing dependencies...");
    let _ = app.emit("sidecar-provision-progress", serde_json::json!({
        "status": "installing_dependencies",
        "message": "Installing analysis dependencies (this may take several minutes)..."
    }));

    let output = tokio::process::Command::new(&uv_bin)
        .args([
            "sync",
            "--project",
            &sidecar_src.to_string_lossy(),
            "--python",
            "3.13",
            "--frozen",
        ])
        .env("UV_PROJECT_ENVIRONMENT", &venv_dir)
        .env("UV_PYTHON_INSTALL_DIR", &python_install_dir)
        .output()
        .await?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        anyhow::bail!("Failed to install dependencies: {}", stderr);
    }

    info!("Sidecar provisioning complete");
    let _ = app.emit("sidecar-provision-progress", serde_json::json!({
        "status": "complete",
        "message": "Analysis engine ready"
    }));

    Ok(())
}
