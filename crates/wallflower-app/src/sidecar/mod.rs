pub mod grpc_client;

use std::process::{Child, Command, Stdio};
use tracing::info;

const MAX_RESTARTS: u32 = 3;
const STARTUP_TIMEOUT_MS: u64 = 30000;

pub struct SidecarManager {
    process: Option<Child>,
    port: u16,
    restart_count: u32,
    sidecar_dir: String,
}

impl SidecarManager {
    pub fn new(port: u16, sidecar_dir: String) -> Self {
        Self {
            process: None,
            port,
            restart_count: 0,
            sidecar_dir,
        }
    }

    /// Ensure the sidecar is running. Spawns it lazily on first call (D-06).
    /// Returns the gRPC port to connect to.
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

    /// Spawn the Python sidecar process.
    /// Uses `uv run --project {sidecar_dir} python -m wallflower_sidecar --port {port}`
    async fn spawn(&mut self) -> anyhow::Result<()> {
        // Kill any existing process first
        self.kill();

        info!(
            "Spawning analysis sidecar on port {} from {}",
            self.port, self.sidecar_dir
        );

        // Verify sidecar directory exists before attempting spawn
        if !std::path::Path::new(&self.sidecar_dir).exists() {
            anyhow::bail!(
                "Sidecar directory not found: {}. Set WALLFLOWER_SIDECAR_DIR env var or ensure sidecar is bundled.",
                self.sidecar_dir
            );
        }

        let child = Command::new("uv")
            .args([
                "run",
                "--project",
                &self.sidecar_dir,
                "python",
                "-m",
                "wallflower_sidecar",
                "--port",
                &self.port.to_string(),
            ])
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()?;

        self.process = Some(child);
        self.restart_count += 1;

        // Wait for health check to pass (with timeout)
        self.wait_for_healthy().await?;
        info!("Analysis sidecar is healthy on port {}", self.port);
        Ok(())
    }

    /// Wait for the gRPC health check to pass.
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

    /// Reset restart count (call after successful analysis).
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
        self.kill(); // D-07: killed when app quits
    }
}

/// Resolve the sidecar directory path.
/// Priority: WALLFLOWER_SIDECAR_DIR env var > Tauri resource_dir > relative to CARGO_MANIFEST_DIR (dev)
pub fn resolve_sidecar_dir(app_handle: Option<&tauri::AppHandle>) -> String {
    // 1. Env var override (dev/test)
    if let Ok(dir) = std::env::var("WALLFLOWER_SIDECAR_DIR") {
        return dir;
    }
    // 2. Tauri resource dir (bundled builds)
    if let Some(handle) = app_handle {
        use tauri::Manager;
        if let Ok(resource_dir) = handle.path().resource_dir() {
            let sidecar_path = resource_dir.join("sidecar");
            if sidecar_path.exists() {
                return sidecar_path.to_string_lossy().to_string();
            }
        }
    }
    // 3. Relative to cargo manifest (dev mode fallback)
    let manifest_dir = env!("CARGO_MANIFEST_DIR");
    let dev_path = std::path::PathBuf::from(manifest_dir).join("../../sidecar");
    dev_path
        .canonicalize()
        .unwrap_or(dev_path)
        .to_string_lossy()
        .to_string()
}
