use std::path::Path;

use clap::{Parser, Subcommand};
use wallflower_core::db::{self, Database};
use wallflower_core::import;
use wallflower_core::settings;

#[derive(Parser)]
#[command(name = "wallflower", about = "Jam and sample manager CLI", version)]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Import audio files into the library
    Import {
        /// Path to file or directory to import
        path: String,
    },
    /// List all jams in the library
    List {
        /// Output format (table, json)
        #[arg(short, long, default_value = "table")]
        format: String,
    },
    /// Show application status
    Status,
    /// View or update settings
    Settings {
        /// Setting key to view or update
        key: Option<String>,
        /// New value for the setting
        value: Option<String>,
    },
}

fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt::init();

    let cli = Cli::parse();
    let db = Database::open_default()?;
    let config = settings::load_config(&db.conn)?;

    match cli.command {
        Commands::Import { path } => {
            settings::ensure_storage_dir(&config)?;
            let p = Path::new(&path);

            // Warn if importing from a sync folder
            if let Some(service) = settings::is_in_sync_folder(p) {
                eprintln!(
                    "Warning: Source file is in a {} sync folder. \
                     Files will be copied to local storage.",
                    service
                );
            }

            if p.is_dir() {
                let results = import::import_directory(&db.conn, &config.storage_dir, p)?;
                print_import_results(&results);
            } else if p.is_file() {
                let result = import::import_file(&db.conn, &config.storage_dir, p);
                print_import_results(&[result]);
            } else {
                eprintln!("Error: Path does not exist: {path}");
                std::process::exit(1);
            }
        }
        Commands::List { format } => {
            let jams = db::list_jams(&db.conn)?;
            if format == "json" {
                println!("{}", serde_json::to_string_pretty(&jams)?);
            } else {
                if jams.is_empty() {
                    println!("No jams in library. Import some audio files with: wallflower import <path>");
                } else {
                    println!(
                        "{:<40} {:<20} {:<10} {:<6}",
                        "Filename", "Imported", "Duration", "Format"
                    );
                    println!("{}", "-".repeat(80));
                    for jam in &jams {
                        let dur = jam
                            .duration_seconds
                            .map(|d| format!("{:.1}s", d))
                            .unwrap_or_else(|| "-".into());
                        let date = &jam.imported_at[..std::cmp::min(19, jam.imported_at.len())];
                        println!(
                            "{:<40} {:<20} {:<10} {:<6}",
                            truncate(&jam.filename, 38),
                            date,
                            dur,
                            jam.format,
                        );
                    }
                    println!("\n{} jam(s) total", jams.len());
                }
            }
        }
        Commands::Status => {
            let jams = db::list_jams(&db.conn)?;
            println!("Wallflower CLI v{}", env!("CARGO_PKG_VERSION"));
            println!("Status: OK");
            println!("Jams in library: {}", jams.len());
            println!(
                "Watch folder: {}",
                config.watch_folder.display()
            );
            println!(
                "Storage directory: {}",
                config.storage_dir.display()
            );
            println!(
                "Duplicate handling: {}",
                config.duplicate_handling
            );
        }
        Commands::Settings { key, value } => {
            match (key.as_deref(), value.as_deref()) {
                (Some(k), Some(v)) => {
                    db::set_setting(&db.conn, k, v)?;
                    println!("Updated: {k} = {v}");
                }
                (Some(k), None) => {
                    match db::get_setting(&db.conn, k)? {
                        Some(v) => println!("{k} = {v}"),
                        None => println!("Setting '{k}' not found"),
                    }
                }
                (None, _) => {
                    let all = db::get_all_settings(&db.conn)?;
                    if all.is_empty() {
                        println!("No settings configured.");
                    } else {
                        for (k, v) in &all {
                            println!("{k} = {v}");
                        }
                    }
                }
            }
        }
    }

    Ok(())
}

fn print_import_results(results: &[import::ImportResult]) {
    let mut imported = 0;
    let mut duplicates = 0;
    let mut errors = 0;

    for r in results {
        match r {
            import::ImportResult::Imported { filename, .. } => {
                println!("  Imported: {filename}");
                imported += 1;
            }
            import::ImportResult::Duplicate { filename } => {
                println!("  Skipped (duplicate): {filename}");
                duplicates += 1;
            }
            import::ImportResult::Error { filename, error } => {
                eprintln!("  Error importing {filename}: {error}");
                errors += 1;
            }
        }
    }

    println!(
        "\nImport complete: {imported} imported, {duplicates} duplicates skipped, {errors} errors"
    );
}

fn truncate(s: &str, max: usize) -> String {
    if s.len() <= max {
        s.to_string()
    } else {
        format!("{}...", &s[..max.saturating_sub(3)])
    }
}
