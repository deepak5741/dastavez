import { HTTPException } from "hono/http-exception";
import type { Context } from "hono";
import type { z, ZodTypeAny } from "zod";

/** Stops the request with a JSON error body: { "error": message }. */
export function fail(status: 400 | 401 | 403 | 404 | 409 | 422 | 429 | 503, message: string): never {
  throw new HTTPException(status, {
    res: new Response(JSON.stringify({ error: message }), {
      status,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    }),
  });
}

/** Parses the JSON body against a schema, failing with a readable 422 message. */
export async function body<S extends ZodTypeAny>(c: Context, schema: S): Promise<z.output<S>> {
  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    fail(400, "Send the request body as JSON.");
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    fail(422, `${issue.path.join(".") || "body"}: ${issue.message}`);
  }
  return parsed.data;
}

/** Fills {placeholders} in a UI string. */
export function format(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ""));
}

/** Small fixed-window rate limiter, per key, kept in memory. */
export function rateLimiter(limit: number, windowMs: number) {
  const hits = new Map<string, { count: number; resetAt: number }>();
  return (key: string) => {
    const now = Date.now();
    const entry = hits.get(key);
    if (!entry || entry.resetAt < now) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
      if (hits.size > 10_000) for (const [k, v] of hits) if (v.resetAt < now) hits.delete(k);
      return;
    }
    entry.count++;
    if (entry.count > limit) fail(429, "Too many attempts. Wait a minute and try again.");
  };
}

export function clientIp(c: Context): string {
  return c.req.header("x-forwarded-for")?.split(",")[0].trim() ?? c.req.header("x-real-ip") ?? "local";
}
