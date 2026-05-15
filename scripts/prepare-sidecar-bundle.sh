#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$SCRIPT_DIR/.."
BUNDLE_DIR="$ROOT/sidecar-bundle"

echo "Preparing sidecar bundle..."

rm -rf "$BUNDLE_DIR"
mkdir -p "$BUNDLE_DIR"

ARCH="${1:-aarch64}"
echo "Target architecture: $ARCH"

echo "Downloading uv binary ($ARCH-apple-darwin)..."
curl -LsSf "https://github.com/astral-sh/uv/releases/latest/download/uv-${ARCH}-apple-darwin.tar.gz" \
    | tar xz -C "$BUNDLE_DIR" --strip-components=1 "uv-${ARCH}-apple-darwin/uv"
chmod +x "$BUNDLE_DIR/uv"

echo "Archiving sidecar source..."
tar czf "$BUNDLE_DIR/sidecar.tar.gz" -C "$ROOT/sidecar" pyproject.toml uv.lock src

echo "Sidecar bundle ready at: $BUNDLE_DIR"
ls -lh "$BUNDLE_DIR"
