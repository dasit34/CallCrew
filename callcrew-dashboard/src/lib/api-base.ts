/**
 * API base URL (backend origin) for fetch calls.
 *
 * Rules:
 * - In all environments, prefer NEXT_PUBLIC_API_BASE_URL.
 * - In local dev, fall back to http://localhost:3000 if no env var is set.
 * - In production, if NEXT_PUBLIC_API_BASE_URL is not set, fall back to same-origin (`/api/...`).
 *
 * This avoids hardcoded domains so that:
 * - All environments can be configured via a single env var.
 * - Production does not silently point at the wrong backend.
 */
export function getApiBase(): string {
  if (typeof window === "undefined") return "";

  const envBase = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (envBase) {
    return envBase.replace(/\/$/, "");
  }

  const hostname = window.location.hostname;

  // Local development convenience
  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return "http://localhost:3000";
  }

  // Production/staging fallback: same-origin (frontend and backend on same host)
  // Callers will use `${getApiBase()}/api/...`; when this returns "",
  // that resolves to `/api/...` on the current origin.
  console.warn(
    "[api-base] NEXT_PUBLIC_API_BASE_URL is not set; falling back to same-origin '/api' calls."
  );
  return "";
}
