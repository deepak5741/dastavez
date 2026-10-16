# Dastavez API

Deno + Hono + PostgreSQL. Serves all site content (languages, interface text, document guides in every language), search, user accounts and a token-protected admin API for editing content.

## Setup

```bash
cp .env.example .env     # DATABASE_URL, ADMIN_TOKEN, CORS_ORIGINS, PORT
deno task setup          # = migrate (create tables) + seed (load content from seed/)
deno task dev            # watch mode on http://localhost:8000
deno task test           # end-to-end tests against the database
```

`deno task seed` can be re-run any time: it overwrites content rows from `seed/` and never touches user accounts.

## Data model

| Table | Holds |
|---|---|
| `languages` | code, native and English name, order, enabled |
| `ui_strings` | every interface text per language (`lang_code`, `key`, `value`); English is the fallback |
| `categories` | category ids; labels are UI strings `cat_<id>` |
| `documents` | language-independent facts: category, icon, portal, helpline, search aliases, YouTube queries, one link per step |
| `document_translations` | per document and language: name, issuer, fee, time, mode, eligibility, required documents, steps, tips |
| `users`, `sessions` | accounts (PBKDF2-SHA256 password hashes) and sessions (only token hashes stored) |
| `saved_documents`, `step_progress` | each user's saved guides and completed steps |

A step link in `documents.step_links` is `null` (no link), `"portal"` (links to the document's portal, labelled by the step's translated `w` text) or a bare domain such as `"uidai.gov.in"`.

## Endpoints

All responses are JSON. Errors look like `{ "error": "Readable message" }`. `lang` falls back to `en` when missing or unknown.

### Content (public, cached 60s)

| Method | Path | Returns |
|---|---|---|
| GET | `/api/bootstrap?lang=hi` | `{ lang, languages, ui, categories }`: everything the app shell needs |
| GET | `/api/languages` | `{ languages }` |
| GET | `/api/ui/:lang` | `{ lang, strings }` |
| GET | `/api/categories?lang=hi` | `{ lang, categories: [{ id, label }] }` |
| GET | `/api/documents?lang=&q=&category=&popular=1&ids=a,b` | `{ lang, items: DocumentSummary[] }`. `q` searches names, aliases and categories in English and the chosen language |
| GET | `/api/documents/:id?lang=hi` | `{ lang, document }` with steps (`title`, `body`, `linkLabel`, `linkUrl`), required docs, tips, videos, portal, helpline |

### Accounts

| Method | Path | Body |
|---|---|---|
| POST | `/api/auth/signup` | `{ name, email, password }` (password 8+ chars) → `{ token, user }` |
| POST | `/api/auth/login` | `{ email, password }` → `{ token, user }` |
| POST | `/api/auth/logout` | (bearer token) |

Send the token as `Authorization: Bearer <token>` to:

| Method | Path | |
|---|---|---|
| GET | `/api/me` | `{ user }` |
| GET | `/api/me/state` | `{ saved: [ids], progress: { docId: [stepIndexes] } }` |
| PUT / DELETE | `/api/me/saved/:id` | save / un-save a document |
| PUT | `/api/me/progress/:id` | `{ completed: [0, 2] }` |
| POST | `/api/me/import` | `{ saved?: [ids], progress?: {...} }` merges guest data into the account |

Sign-up and login are limited to 20 attempts per minute per IP.

### Admin (needs `Authorization: Bearer $ADMIN_TOKEN`)

The admin API is off unless `ADMIN_TOKEN` (16+ characters) is set. The website never forwards admin requests; call the API directly.

| Method | Path | Body |
|---|---|---|
| PUT | `/api/admin/languages/:code` | `{ nativeName, englishName, sortOrder?, enabled? }` |
| GET | `/api/admin/ui/:lang` | stored strings for one language |
| PUT | `/api/admin/ui/:lang` | `{ strings: { key: value } }`: upserts only these keys |
| DELETE | `/api/admin/ui/:lang/:key` | |
| PUT | `/api/admin/categories/:id` | `{ sortOrder }` (add its label as UI string `cat_<id>`) |
| GET | `/api/admin/documents/:id` | raw document and all translations |
| PUT | `/api/admin/documents/:id` | `{ category, icon, portalUrl, helpline, aliases, youtubeQueries, stepLinks, popular, sortOrder, published }` |
| PUT | `/api/admin/documents/:id/translations/:lang` | `{ name, issuer, fee, time, mode, eligibility, requiredDocs, steps: [{ t, d, w? }], tips }`. Step count must match `stepLinks` |
| DELETE | `/api/admin/documents/:id` | |

Example: change a headline in Hindi.

```bash
curl -X PUT http://localhost:8000/api/admin/ui/hi \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{"strings":{"heroB":"एक-एक कदम करके।"}}'
```

## Environment

| Variable | Meaning |
|---|---|
| `DATABASE_URL` | Postgres connection string (`?sslmode=require` for hosted databases) |
| `PORT` | default 8000 |
| `CORS_ORIGINS` | comma-separated origins allowed from browsers; empty allows any |
| `ADMIN_TOKEN` | secret for `/api/admin`; empty turns admin off |
| `DB_POOL_SIZE` | default 10 |
