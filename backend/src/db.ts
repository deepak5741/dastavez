import postgres from "postgres";

const url = Deno.env.get("DATABASE_URL");
if (!url) {
  throw new Error("DATABASE_URL is not set. Copy backend/.env.example to backend/.env and fill it in.");
}

// Column names come back camelCased (portal_url -> portalUrl).
export const sql = postgres(url, {
  max: Number(Deno.env.get("DB_POOL_SIZE") ?? 10),
  idle_timeout: 20,
  transform: postgres.camel,
  onnotice: () => {},
});
