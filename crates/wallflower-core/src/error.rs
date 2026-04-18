use thiserror::Error;

#[derive(Error, Debug)]
pub enum WallflowerError {
    #[error("Database error: {0}")]
    Db(#[from] rusqlite::Error),

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("Import error: {0}")]
    Import(String),

    #[error("Configuration error: {0}")]
    Config(String),
}

pub type Result<T> = std::result::Result<T, WallflowerError>;
