
const isBrowser = typeof window !== "undefined";

function normalizeBasePath(input: string) {
  const trimmed = input.trim();
  if (!trimmed || trimmed === "/") return "";
  const withLeadingSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return withLeadingSlash.replace(/\/+$/, "");
}

let cachedBasePath: string | null = null;

export function getBasePath() {
  if (!isBrowser) return "";
  if (cachedBasePath !== null) return cachedBasePath;

  const meta = document.querySelector('meta[name="omega-base"]')?.getAttribute("content");
  if (meta) {
    cachedBasePath = normalizeBasePath(meta);
    return cachedBasePath;
  }

  // GitHub Pages repo sites are served at https://<org>.github.io/<repo>/...
  if (window.location.hostname.endsWith("github.io")) {
    const parts = window.location.pathname.split("/").filter(Boolean);
    if (parts.length > 0) {
      cachedBasePath = normalizeBasePath(`/${parts[0]}`);
      return cachedBasePath;
    }
  }

  cachedBasePath = "";
  return cachedBasePath;
}

export function withBasePath(href: string) {
  const basePath = getBasePath();
  if (!basePath) return href;

  // If it looks like an absolute URL (scheme:...), don't touch it.
  if (/^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(href)) return href;
  if (href.startsWith("#")) return href;

  if (
    href === basePath ||
    href.startsWith(`${basePath}/`) ||
    href.startsWith(`${basePath}?`) ||
    href.startsWith(`${basePath}#`)
  ) {
    return href;
  }

  if (href.startsWith("/")) return `${basePath}${href}`;
  if (href.startsWith("?") || href.startsWith("#")) return `${basePath}/${href}`;
  return `${basePath}/${href}`;
}

export function stripBasePath(pathname: string) {
  const basePath = getBasePath();
  const normalizedPath = pathname || "/";
  if (!basePath) return normalizedPath;

  if (normalizedPath === basePath) return "/";
  if (normalizedPath.startsWith(`${basePath}/`)) {
    const rest = normalizedPath.slice(basePath.length);
    return rest || "/";
  }

  return normalizedPath;
}

