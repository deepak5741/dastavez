import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { secureHeaders } from "hono/secure-headers";
import { HTTPException } from "hono/http-exception";
import { sql } from "./src/db.ts";
import { content } from "./src/routes/content.ts";
import { auth } from "./src/routes/auth.ts";
import { me } from "./src/routes/me.ts";
import { admin } from "./src/routes/admin.ts";

export const app = new Hono();

// Comma-separated list, e.g. "http://localhost:3000,https://dastavez.example". Empty = allow any origin.
const origins = (Deno.env.get("CORS_ORIGINS") ?? "").split(",").map((s) => s.trim()).filter(Boolean);

app.use("*", logger());
app.use("*", secureHeaders());
app.use(
  "/api/*",
  cors({
    origin: (origin) => (!origins.length || origins.includes(origin) ? origin : null),
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    maxAge: 86400,
  }),
);

app.get("/", (c) => c.json({ name: "Dastavez API", docs: "See backend/README.md", health: "/health" }));

app.get("/health", async (c) => {
  try {
    await sql`SELECT 1`;
    return c.json({ ok: true, db: "up" });
  } catch {
    return c.json({ ok: false, db: "down" }, 503);
  }
});

app.route("/api", content);
app.route("/api/auth", auth);
app.route("/api/me", me);
app.route("/api/admin", admin);

app.notFound((c) => c.json({ error: "Not found." }, 404));

app.onError((err, c) => {
  if (err instanceof HTTPException) return err.getResponse();
  if (err?.name === "ZodError") return c.json({ error: err.message }, 422);
  console.error(err);
  return c.json({ error: "Something went wrong on our side. Try again in a minute." }, 500);
});

if (import.meta.main) {
  const port = Number(Deno.env.get("PORT") ?? 8000);
  Deno.serve({ port, onListen: ({ port }) => console.log(`Dastavez API on http://localhost:${port}`) }, app.fetch);
}
