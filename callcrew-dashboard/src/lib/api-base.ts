/**
 * API base URL (backend origin) for fetch calls.
 * All API calls use ${getApiBase()}/api/...
 * Set NEXT_PUBLIC_API_BASE_URL in env to override (e.g. https://api.callcrew.ai).
 */
export function getApiBase(): string {
  if (typeof window === "undefined") return "";
  const envBase = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (envBase) return envBase.replace(/\/$/, "");
  const h = window.location.hostname;
  if (h === "localhost") return "http://localhost:3000";
  if (h === "www.callcrew.ai" || h === "callcrew.ai") return "https://api.callcrew.ai";
  return "https://api.callcrew.ai";
}
