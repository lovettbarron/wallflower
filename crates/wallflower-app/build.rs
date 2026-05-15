fn main() -> Result<(), Box<dyn std::error::Error>> {
    tonic_prost_build::configure()
        .build_server(false)
        .build_client(true)
        .compile_protos(
            &["../../proto/wallflower_analysis.proto"],
            &["../../proto/"],
        )?;

    // Ensure sidecar-bundle dir has at least one file for Tauri resource glob.
    // Fully populated by scripts/prepare-sidecar-bundle.sh for production builds.
    let sidecar_bundle = std::path::Path::new("../../sidecar-bundle");
    if !sidecar_bundle.exists() {
        std::fs::create_dir_all(sidecar_bundle)?;
    }
    let placeholder = sidecar_bundle.join("BUNDLE_README");
    if !placeholder.exists() {
        std::fs::write(&placeholder, "Run scripts/prepare-sidecar-bundle.sh to populate for production builds.\n")?;
    }

    tauri_build::build();
    Ok(())
}
