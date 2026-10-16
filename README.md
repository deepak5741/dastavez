# Dastavez

Search any Indian government document and see the full process to get it, step by step: who can apply, which papers to carry, every step from form to delivery, fees, timelines, official portals, helplines and YouTube explainers. Available in 11 languages.

- **Frontend:** Nuxt 4 (server-side rendered) in [`frontend/`](frontend)
- **Backend:** Deno + Hono REST API in [`backend/`](backend)
- **Database:** PostgreSQL. All content lives here: languages, every interface text, all document guides and their translations, plus user accounts.

```
Browser ──> Nuxt (frontend/, port 3000) ──/api/*──> Deno API (backend/, port 8000) ──> PostgreSQL
            renders pages on the server          content, search, accounts, admin
            keeps the session in an httpOnly cookie
```

Nothing is hard-coded in the frontend: change a translation, a step or a fee in the database (through the admin API) and the site shows it on the next page load.

## Features

- 16 documents: Passport, Learner's Licence, Driving Licence, Aadhaar, PAN, Voter ID, Ration Card, Birth, Death, Income, Caste, Domicile and Marriage certificates, Ayushman Card, ABHA and e-Shram
- 11 languages: English, हिन्दी, मराठी, ગુજરાતી, বাংলা, ਪੰਜਾਬੀ, ଓଡ଼ିଆ, தமிழ், తెలుగు, ಕನ್ನಡ, മലയാളം
- Server-side search with typo tolerance ("adhaar", "DL") and native-script search
- Step checklist with progress; clickable official links on steps
- Optional accounts (email + password) to save documents and sync progress across devices; guests keep progress in the browser and it moves into the account on sign-up
- Light theme by default, dark on demand; works on phones down to 320px

## Run it locally

You need [Deno 2](https://deno.com), [Node.js 20+](https://nodejs.org) and PostgreSQL 13+.

```bash
# 1. Database
createdb dastavez

# 2. Backend
cd backend
cp .env.example .env          # set DATABASE_URL and a long random ADMIN_TOKEN
deno task setup               # creates tables and loads all content
deno task dev                 # http://localhost:8000

# 3. Frontend (new terminal)
cd frontend
cp .env.example .env
npm install
npm run dev                   # http://localhost:3000
```

Run the API tests with `cd backend && deno task test`.

## Repository layout

```
backend/
  main.ts            API entry point (Hono)
  src/               content service, auth, routes
  db/schema.sql      PostgreSQL tables
  seed/              initial content: languages, documents, locales/<lang>.json
  scripts/           migrate and seed
  main_test.ts       end-to-end API tests
frontend/
  app/               pages, components, composables (Nuxt 4)
  server/            proxy to the API, sign-in cookie handling
docs/                the earlier static version, still served by GitHub Pages
```

## Deploying (free tiers)

| Part | Suggested host | Notes |
|---|---|---|
| PostgreSQL | Neon or Supabase | Copy the connection string (with `?sslmode=require`) into the backend's `DATABASE_URL`, then run `deno task setup` once. |
| Backend | Deno Deploy | Entry point `backend/main.ts`. Set `DATABASE_URL`, `ADMIN_TOKEN`, `CORS_ORIGINS`. |
| Frontend | Vercel or Netlify | Root directory `frontend`. Set `NUXT_API_BASE` to the backend URL. |

## Disclaimer

This is an independent guide, not a government website. Fees and timelines change, so always confirm on the official portal. Translations were machine-assisted and should be reviewed by native speakers.
