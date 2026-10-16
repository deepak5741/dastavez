export default defineEventHandler(async (event) => {
  // Ends the session on the API too; the cookie is cleared even if the API is unreachable.
  await $fetch(apiUrl(event, "/api/auth/logout"), { method: "POST", headers: apiHeaders(event) }).catch(() => {});
  clearSessionCookie(event);
  return { ok: true };
});
