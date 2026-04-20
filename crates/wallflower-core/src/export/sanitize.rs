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
