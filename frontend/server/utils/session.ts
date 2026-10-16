import type { H3Event } from "h3";

export const SESSION_COOKIE = "dz_session";
const THIRTY_DAYS = 60 * 60 * 24 * 30;

/** The session token lives in an httpOnly cookie, so page scripts can never read it. */
export function setSessionCookie(event: H3Event, token: string) {
  setCookie(event, SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: !import.meta.dev,
    path: "/",
    maxAge: THIRTY_DAYS,
  });
}

export function clearSessionCookie(event: H3Event) {
  deleteCookie(event, SESSION_COOKIE, { path: "/" });
}

export function apiUrl(event: H3Event, path: string): string {
  const { apiBase } = useRuntimeConfig(event);
  return `${String(apiBase).replace(/\/$/, "")}${path}`;
}

/** Headers to send to the Deno API: the session as a bearer token, plus the visitor's IP for rate limiting. */
export function apiHeaders(event: H3Event): Record<string, string> {
  const headers: Record<string, string> = {};
  const token = getCookie(event, SESSION_COOKIE);
  if (token) headers.authorization = `Bearer ${token}`;
  const ip = getRequestIP(event, { xForwardedFor: true });
  if (ip) headers["x-forwarded-for"] = ip;
  return headers;
}
