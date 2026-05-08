const GITHUB_REPO = "lovettbarron/wallflower";
const RELEASES_URL = `https://api.github.com/repos/${GITHUB_REPO}/releases`;
const STORAGE_KEY = "wallflower_update_check";
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;

export interface ReleaseInfo {
  version: string;
  name: string;
  body: string;
  htmlUrl: string;
  dmgUrl: string;
  publishedAt: string;
}

interface CachedCheck {
  lastChecked: number;
  release: ReleaseInfo | null;
  currentVersion: string;
}

function compareVersions(a: string, b: string): number {
  const pa = a.replace(/^v/, "").split(".").map(Number);
  const pb = b.replace(/^v/, "").split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const na = pa[i] ?? 0;
    const nb = pb[i] ?? 0;
    if (na !== nb) return na - nb;
  }
  return 0;
}

function getCached(): CachedCheck | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CachedCheck;
  } catch {
    return null;
  }
}

function setCache(data: CachedCheck) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function dismissUpdate() {
  const cached = getCached();
  if (cached) {
    setCache({ ...cached, release: null });
  }
}

export async function checkForUpdate(
  currentVersion: string,
): Promise<ReleaseInfo | null> {
  const cached = getCached();
  if (
    cached &&
    cached.currentVersion === currentVersion &&
    Date.now() - cached.lastChecked < CHECK_INTERVAL_MS
  ) {
    return cached.release;
  }

  try {
    const res = await fetch(RELEASES_URL, {
      headers: { Accept: "application/vnd.github.v3+json" },
    });
    if (!res.ok) return cached?.release ?? null;

    const releases: Array<{
      tag_name: string;
      name: string;
      body: string;
      html_url: string;
      draft: boolean;
      prerelease: boolean;
      published_at: string;
      assets: Array<{
        name: string;
        browser_download_url: string;
      }>;
    }> = await res.json();

    for (const rel of releases) {
      if (rel.draft || rel.prerelease) continue;

      const dmgAsset = rel.assets.find((a) =>
        a.name.toLowerCase().endsWith(".dmg"),
      );
      if (!dmgAsset) continue;

      if (compareVersions(rel.tag_name, currentVersion) > 0) {
        const release: ReleaseInfo = {
          version: rel.tag_name.replace(/^v/, ""),
          name: rel.name || rel.tag_name,
          body: rel.body || "",
          htmlUrl: rel.html_url,
          dmgUrl: dmgAsset.browser_download_url,
          publishedAt: rel.published_at,
        };
        setCache({ lastChecked: Date.now(), release, currentVersion });
        return release;
      }
    }

    setCache({ lastChecked: Date.now(), release: null, currentVersion });
    return null;
  } catch {
    return cached?.release ?? null;
  }
}
