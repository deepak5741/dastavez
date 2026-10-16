// Forwards every /api/* request to the Deno API, attaching the session from the cookie.
// Sign-in, sign-up and sign-out have their own handlers in ./auth because they set the cookie.
export default defineEventHandler((event) => {
  if (event.path.startsWith("/api/admin")) {
    // Admin calls go straight to the Deno API with the admin token; never through the website.
    throw createError({ statusCode: 404, statusMessage: "Not found" });
  }
  return proxyRequest(event, apiUrl(event, event.path), {
    headers: apiHeaders(event),
    // The browser's cookies are for this site only; the API authenticates by bearer token.
    cookieDomainRewrite: { "*": "" },
  });
});
