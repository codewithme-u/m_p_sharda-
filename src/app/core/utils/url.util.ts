// src/app/core/utils/url.util.ts
import { environment } from "../../../environments/environment";
export function fullApiUrl(pathOrUrl?: string | null): string | null {
  if (!pathOrUrl) return null;

  // Case 1: absolute URL
  if (/^https?:\/\//i.test(pathOrUrl)) {
    // If it's localhost, convert to production domain
    if (/https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i.test(pathOrUrl)) {
      const relative = pathOrUrl.replace(/^https?:\/\/[^\/]+/, '');
      const base = (environment.apiUrl || '').replace(/\/$/, '');
      return base ? `${base}${relative}` : relative;
    }
    // Otherwise it's a valid external absolute URL — use as-is
    return pathOrUrl;
  }

  // Case 2: backend returned a relative path: "uploads/file.png"
  const base = (environment.apiUrl || '').replace(/\/$/, '');
  const cleaned = pathOrUrl.replace(/^\//, '');

  // In production -> prepend domain
  // In development -> keep relative for dev server proxy
  return base ? `${base}/${cleaned}` : `/${cleaned}`;
}
