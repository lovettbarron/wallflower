use sha2::{Digest, Sha256};
use std::fs::File;
use std::io::{BufReader, Read};
use std::path::Path;

use crate::error::Result;

/// Compute a streaming SHA-256 hash of the file at the given path.
/// Returns a lowercase hex string. Uses constant memory regardless of file size.
pub fn compute_sha256(path: &Path) -> Result<String> {
    let file = File::open(path)?;
    let mut reader = BufReader::with_capacity(8192, file);
    let mut hasher = Sha256::new();
    let mut buffer = [0u8; 8192];
    loop {
        let n = reader.read(&mut buffer)?;
        if n == 0 {
            break;
        }
        hasher.update(&buffer[..n]);
    }
    Ok(format!("{:x}", hasher.finalize()))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;
    use tempfile::NamedTempFile;

    #[test]
    fn test_hash_consistency() {
        let mut file = NamedTempFile::new().unwrap();
        file.write_all(b"hello world audio data").unwrap();
        file.flush().unwrap();

        let hash1 = compute_sha256(file.path()).unwrap();
        let hash2 = compute_sha256(file.path()).unwrap();
        assert_eq!(hash1, hash2);
        assert_eq!(hash1.len(), 64); // SHA-256 hex is 64 chars
    }

    #[test]
    fn test_hash_difference() {
        let mut file1 = NamedTempFile::new().unwrap();
        file1.write_all(b"audio data one").unwrap();
        file1.flush().unwrap();

        let mut file2 = NamedTempFile::new().unwrap();
        file2.write_all(b"audio data two").unwrap();
        file2.flush().unwrap();

        let hash1 = compute_sha256(file1.path()).unwrap();
        let hash2 = compute_sha256(file2.path()).unwrap();
        assert_ne!(hash1, hash2);
    }
}
