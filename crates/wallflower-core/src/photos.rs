use crate::error::{Result, WallflowerError};
use std::path::{Path, PathBuf};

/// Copy a photo file to the app's photo storage directory.
///
/// Returns (filename, stored_path) where stored_path is the full path to the copied file.
/// Files are stored at `{target_dir}/photos/{jam_id}/{uuid}.{ext}`.
pub fn store_photo(
    source_path: &Path,
    target_dir: &Path,
    jam_id: &str,
) -> Result<(String, String)> {
    if !source_path.exists() {
        return Err(WallflowerError::Config(format!(
            "Source photo does not exist: {}",
            source_path.display()
        )));
    }

    let ext = source_path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("jpg");

    let original_filename = source_path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("photo")
        .to_string();

    let stored_filename = format!("{}.{}", uuid::Uuid::new_v4(), ext);
    let photos_dir = target_dir.join("photos").join(jam_id);
    std::fs::create_dir_all(&photos_dir)?;

    let dest_path = photos_dir.join(&stored_filename);
    std::fs::copy(source_path, &dest_path)?;

    Ok((original_filename, dest_path.to_string_lossy().to_string()))
}

/// Generate a thumbnail from a source image.
///
/// Creates a JPEG thumbnail with the longest side at most `max_dimension` pixels.
/// Thumbnail is saved to `{target_dir}/thumbnails/{stem}_thumb.jpg`.
/// Returns the path to the generated thumbnail.
pub fn generate_thumbnail(
    source_path: &Path,
    target_dir: &Path,
    max_dimension: u32,
) -> Result<String> {
    let img = image::open(source_path).map_err(|e| {
        WallflowerError::Config(format!("Failed to open image: {}", e))
    })?;

    let thumb = img.thumbnail(max_dimension, max_dimension);

    let thumbnails_dir = target_dir.join("thumbnails");
    std::fs::create_dir_all(&thumbnails_dir)?;

    let stem = source_path
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("photo");
    let thumb_filename = format!("{}_thumb.jpg", stem);
    let thumb_path = thumbnails_dir.join(&thumb_filename);

    thumb.save(&thumb_path).map_err(|e| {
        WallflowerError::Config(format!("Failed to save thumbnail: {}", e))
    })?;

    Ok(thumb_path.to_string_lossy().to_string())
}

/// Get the photos directory for a given base dir and jam ID.
pub fn photos_dir(base_dir: &Path, jam_id: &str) -> PathBuf {
    base_dir.join("photos").join(jam_id)
}

#[cfg(test)]
mod tests {
    use super::*;
    use image::GenericImageView;

    fn create_test_image(dir: &Path, name: &str, width: u32, height: u32) -> PathBuf {
        let path = dir.join(name);
        let img = image::ImageBuffer::from_fn(width, height, |x, y| {
            if (x + y) % 2 == 0 {
                image::Rgb([255u8, 128, 0])
            } else {
                image::Rgb([0u8, 64, 128])
            }
        });
        img.save(&path).unwrap();
        path
    }

    #[test]
    fn test_store_photo_copies_file() {
        let source_dir = tempfile::tempdir().unwrap();
        let target_dir = tempfile::tempdir().unwrap();

        let source_path = create_test_image(source_dir.path(), "patch.png", 100, 100);

        let (filename, stored_path) =
            store_photo(&source_path, target_dir.path(), "jam-123").unwrap();

        assert_eq!(filename, "patch.png");
        assert!(Path::new(&stored_path).exists());
        assert!(stored_path.contains("photos/jam-123"));
    }

    #[test]
    fn test_store_photo_missing_source() {
        let target_dir = tempfile::tempdir().unwrap();
        let result = store_photo(
            Path::new("/nonexistent/photo.jpg"),
            target_dir.path(),
            "jam-123",
        );
        assert!(result.is_err());
    }

    #[test]
    fn test_generate_thumbnail() {
        let source_dir = tempfile::tempdir().unwrap();
        let target_dir = tempfile::tempdir().unwrap();

        let source_path = create_test_image(source_dir.path(), "big_photo.png", 800, 600);

        let thumb_path =
            generate_thumbnail(&source_path, target_dir.path(), 200).unwrap();

        assert!(Path::new(&thumb_path).exists());
        assert!(thumb_path.contains("_thumb.jpg"));

        // Verify thumbnail dimensions
        let thumb_img = image::open(&thumb_path).unwrap();
        let (w, h) = thumb_img.dimensions();
        assert!(w <= 200 && h <= 200);
        // Aspect ratio preserved: 800x600 -> 200x150
        assert_eq!(w, 200);
        assert_eq!(h, 150);
    }

    #[test]
    fn test_generate_thumbnail_portrait() {
        let source_dir = tempfile::tempdir().unwrap();
        let target_dir = tempfile::tempdir().unwrap();

        let source_path = create_test_image(source_dir.path(), "portrait.png", 400, 800);

        let thumb_path =
            generate_thumbnail(&source_path, target_dir.path(), 200).unwrap();

        let thumb_img = image::open(&thumb_path).unwrap();
        let (w, h) = thumb_img.dimensions();
        assert!(w <= 200 && h <= 200);
        assert_eq!(h, 200);
        assert_eq!(w, 100);
    }
}
