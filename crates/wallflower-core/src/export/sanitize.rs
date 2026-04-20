use std::path::{Path, PathBuf};

/// Sanitize a user-provided name for use as a filename.
/// Replaces /\:*?"<>| with -, trims whitespace and dots, limits to 200 chars.
pub fn sanitize_filename(name: &str) -> String {
    let sanitized: String = name
        .chars()
        .map(|c| match c {
            '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|' => '-',
            _ => c,
        })
        .collect();
    let trimmed = sanitized.trim().trim_matches('.');
    let limited = if trimmed.len() > 200 {
        &trimmed[..200]
    } else {
        trimmed
    };
    if limited.is_empty() {
        "untitled".to_string()
    } else {
        limited.to_string()
    }
}

/// Build export path: {export_root}/{jam_name}/{bookmark_name}.{ext}
/// If path already exists, append " (2)", " (3)", etc.
pub fn resolve_export_path(
    export_root: &Path,
    jam_name: &str,
    bookmark_name: &str,
    extension: &str,
) -> PathBuf {
    let safe_jam = sanitize_filename(jam_name);
    let safe_bookmark = sanitize_filename(bookmark_name);
    let dir = export_root.join(&safe_jam);
    let base = dir.join(format!("{}.{}", safe_bookmark, extension));
    if !base.exists() {
        return base;
    }
    let mut counter = 2;
    loop {
        let candidate = dir.join(format!("{} ({}).{}", safe_bookmark, counter, extension));
        if !candidate.exists() {
            return candidate;
        }
        counter += 1;
    }
}

/// Build stems export directory: {export_root}/{jam_name}/{bookmark_name}_stems/
pub fn resolve_stems_dir(export_root: &Path, jam_name: &str, bookmark_name: &str) -> PathBuf {
    let safe_jam = sanitize_filename(jam_name);
    let safe_bookmark = sanitize_filename(bookmark_name);
    export_root
        .join(&safe_jam)
        .join(format!("{}_stems", safe_bookmark))
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[test]
    fn test_sanitize_filename_replaces_special_chars() {
        assert_eq!(sanitize_filename("cool/bass:riff"), "cool-bass-riff");
    }

    #[test]
    fn test_sanitize_filename_empty_returns_untitled() {
        assert_eq!(sanitize_filename(""), "untitled");
    }

    #[test]
    fn test_sanitize_filename_truncates_long_names() {
        let long_name = "a".repeat(250);
        let result = sanitize_filename(&long_name);
        assert_eq!(result.len(), 200);
    }

    #[test]
    fn test_sanitize_filename_trims_dots() {
        assert_eq!(sanitize_filename("...dots..."), "dots");
    }

    #[test]
    fn test_resolve_export_path_basic() {
        let tmp = TempDir::new().unwrap();
        let path = resolve_export_path(tmp.path(), "My Jam", "Cool Riff", "wav");
        assert_eq!(
            path,
            tmp.path().join("My Jam").join("Cool Riff.wav")
        );
    }

    #[test]
    fn test_resolve_export_path_collision() {
        let tmp = TempDir::new().unwrap();
        let dir = tmp.path().join("My Jam");
        std::fs::create_dir_all(&dir).unwrap();
        std::fs::write(dir.join("Cool Riff.wav"), b"existing").unwrap();

        let path = resolve_export_path(tmp.path(), "My Jam", "Cool Riff", "wav");
        assert_eq!(
            path,
            tmp.path().join("My Jam").join("Cool Riff (2).wav")
        );
    }
}
