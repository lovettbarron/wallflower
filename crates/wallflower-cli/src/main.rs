use clap::{Parser, Subcommand};

#[derive(Parser)]
#[command(name = "wallflower", about = "Jam and sample manager CLI", version)]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Show application status
    Status,
}

fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt::init();

    let cli = Cli::parse();

    match cli.command {
        Commands::Status => {
            println!("Wallflower CLI v{}", env!("CARGO_PKG_VERSION"));
            println!("Status: OK");
        }
    }

    Ok(())
}
