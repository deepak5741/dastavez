import type { H3Event } from "h3";

type AuthResponse = {
  token: string;
  user: { id: string; name: string; email: string };
  preferences: { lang: string | null; theme: "light" | "dark" | null };
};

/**
 * Sends a sign-in or sign-up to the API. On success the token goes into the cookie and only the user
 * comes back to the browser. API errors are passed through with their status and message.
 */
export async function forwardAuth(event: H3Event, path: string) {
  const body = await readBody(event);
  try {
    const res = await $fetch<AuthResponse>(apiUrl(event, path), {
      method: "POST",
      body,
      headers: apiHeaders(event),
    });
    setSessionCookie(event, res.token);
    return { user: res.user, preferences: res.preferences };
  } catch (err: unknown) {
    const e = err as { statusCode?: number; data?: { error?: string } };
    throw createError({
      statusCode: e.statusCode ?? 502,
      statusMessage: e.data?.error ?? "Could not reach the server.",
      data: { error: e.data?.error ?? "Could not reach the server." },
    });
  }
}
