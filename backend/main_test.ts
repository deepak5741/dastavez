// End-to-end API tests against the real database. Run: deno task test (after deno task setup).
import { assert, assertEquals, assertExists } from "@std/assert";
import { app } from "./main.ts";
import { sql } from "./src/db.ts";

const call = async (method: string, path: string, opts: { body?: unknown; token?: string } = {}) => {
  const res = await app.request(path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
    },
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
  return { status: res.status, json: await res.json() };
};

const testEmail = `test-${crypto.randomUUID().slice(0, 8)}@example.com`;
const opts = { sanitizeOps: false, sanitizeResources: false };

Deno.test({ name: "health reports the database is up", ...opts, fn: async () => {
  const r = await call("GET", "/health");
  assertEquals(r.json, { ok: true, db: "up" });
}});

Deno.test({ name: "bootstrap returns languages, UI text and categories", ...opts, fn: async () => {
  const r = await call("GET", "/api/bootstrap?lang=ta");
  assertEquals(r.status, 200);
  assertEquals(r.json.lang, "ta");
  assertEquals(r.json.languages.length, 11);
  assertEquals(r.json.ui.search, "தேடு");
  assertEquals(r.json.categories.find((c: { id: string }) => c.id === "identity").label, "அடையாளம்");
}});

Deno.test({ name: "unknown language falls back to English", ...opts, fn: async () => {
  const r = await call("GET", "/api/bootstrap?lang=xx");
  assertEquals(r.json.lang, "en");
  assertEquals(r.json.ui.search, "Search");
}});

Deno.test({ name: "documents list is localized, with English subtitle", ...opts, fn: async () => {
  const r = await call("GET", "/api/documents?lang=mr");
  assertEquals(r.json.items.length, 16);
  const passport = r.json.items.find((d: { id: string }) => d.id === "passport");
  assertEquals(passport.name, "पासपोर्ट");
  assertEquals(passport.subtitle, "Passport");
  assertEquals(passport.time, "7–30 दिवस");
  assertEquals(passport.fee, "₹1,500 (तत्काळ ₹3,500)");
}});

Deno.test({ name: "search tolerates misspellings and native script", ...opts, fn: async () => {
  assertEquals((await call("GET", "/api/documents?q=adhaar")).json.items[0].id, "aadhaar");
  assertEquals((await call("GET", "/api/documents?q=dl")).json.items[0].id, "driving-licence");
  assertEquals((await call("GET", `/api/documents?lang=ta&q=${encodeURIComponent("ஆதார்")}`)).json.items[0].id, "aadhaar");
  assertEquals((await call("GET", "/api/documents?q=zzzz")).json.items.length, 0);
}});

Deno.test({ name: "category and popular filters", ...opts, fn: async () => {
  const health = (await call("GET", "/api/documents?category=health")).json.items;
  assert(health.every((d: { category: string }) => d.category === "health"));
  assertEquals((await call("GET", "/api/documents?popular=1")).json.items.length, 5);
}});

Deno.test({ name: "document detail has steps with links and videos", ...opts, fn: async () => {
  const r = await call("GET", "/api/documents/driving-licence?lang=hi");
  const d = r.json.document;
  assertEquals(d.name, "ड्राइविंग लाइसेंस");
  assertEquals(d.steps.length, 6);
  assertEquals(d.time, "7–30 दिन");
  assertEquals(d.requiredDocs.length, 4);
  assertEquals(d.tips.length, 2);
  for (const k of ["issuer", "mode", "eligibility", "fee"]) assert(d[k], `${k} is empty`);
  assertEquals(d.steps[1].linkUrl, "https://sarathi.parivahan.gov.in");
  assertEquals(d.steps[4].linkLabel, "RTO टेस्ट ट्रैक"); // place label links to the portal
  assertEquals(d.steps[4].linkUrl, d.portalUrl);
  assert(d.videos[0].url.includes("Hindi"));
  assertEquals((await call("GET", "/api/documents/nope")).status, 404);
}});

Deno.test({ name: "sign up, saved documents, progress, import, logout", ...opts, fn: async () => {
  const weak = await call("POST", "/api/auth/signup", { body: { name: "T", email: testEmail, password: "short" } });
  assertEquals(weak.status, 422);

  const signup = await call("POST", "/api/auth/signup", {
    body: { name: "Test User", email: testEmail, password: "correct horse 1" },
  });
  assertEquals(signup.status, 201);
  const token = signup.json.token;
  assertExists(token);

  assertEquals((await call("POST", "/api/auth/signup", {
    body: { name: "Again", email: testEmail, password: "correct horse 1" },
  })).status, 409);
  assertEquals((await call("POST", "/api/auth/login", { body: { email: testEmail, password: "wrong pass" } })).status, 401);
  const login = await call("POST", "/api/auth/login", { body: { email: testEmail.toUpperCase(), password: "correct horse 1" } });
  assertEquals(login.status, 200);

  assertEquals((await call("GET", "/api/me")).status, 401);
  assertEquals((await call("GET", "/api/me", { token })).json.user.email, testEmail);

  await call("PUT", "/api/me/saved/passport", { token });
  assertEquals((await call("PUT", "/api/me/saved/nope", { token })).status, 404);
  const p = await call("PUT", "/api/me/progress/passport", { token, body: { completed: [2, 0, 0, 99] } });
  assertEquals(p.json.completed, [0, 2]); // de-duplicated, sorted, out-of-range dropped

  await call("POST", "/api/me/import", { token, body: { saved: ["pan"], progress: { passport: [3], pan: [1] } } });
  const state = (await call("GET", "/api/me/state", { token })).json;
  assertEquals(state.saved.sort(), ["pan", "passport"]);
  assertEquals(state.progress.passport, [0, 2, 3]);

  await call("POST", "/api/auth/logout", { token });
  assertEquals((await call("GET", "/api/me", { token })).status, 401);
}});

Deno.test({ name: "admin API needs the token and validates step counts", ...opts, fn: async () => {
  assertEquals((await call("PUT", "/api/admin/ui/en", { body: { strings: { x: "y" } } })).status, 401);
  const token = Deno.env.get("ADMIN_TOKEN")!;
  const bad = await call("PUT", "/api/admin/documents/passport/translations/en", {
    token,
    body: { name: "P", issuer: "I", fee: "F", time: "T", mode: "M", eligibility: "E", requiredDocs: [], steps: [{ t: "a", d: "b" }] },
  });
  assertEquals(bad.status, 422);
  const ok = await call("PUT", "/api/admin/ui/en", { token, body: { strings: { testKey: "hello" } } });
  assertEquals(ok.json.updated, 1);
  assertEquals((await call("GET", "/api/ui/en")).json.strings.testKey, "hello");
  await call("DELETE", "/api/admin/ui/en/testKey", { token });
}});

Deno.test({ name: "cleanup", ...opts, fn: async () => {
  await sql`DELETE FROM users WHERE email = ${testEmail}`;
  await sql.end();
}});
