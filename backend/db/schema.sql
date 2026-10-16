-- Dastavez database schema (PostgreSQL 13+). Safe to run repeatedly.

-- Content --------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS languages (
  code          text PRIMARY KEY,                -- ISO 639-1, e.g. "hi"
  native_name   text NOT NULL,                   -- "हिन्दी"
  english_name  text NOT NULL,                   -- "Hindi"
  sort_order    int  NOT NULL DEFAULT 0,
  enabled       boolean NOT NULL DEFAULT true
);

-- Every piece of interface text, per language. English is the fallback.
CREATE TABLE IF NOT EXISTS ui_strings (
  lang_code   text NOT NULL REFERENCES languages(code) ON DELETE CASCADE,
  key         text NOT NULL,
  value       text NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (lang_code, key)
);

-- Labels live in ui_strings under "cat_<id>".
CREATE TABLE IF NOT EXISTS categories (
  id          text PRIMARY KEY,
  sort_order  int NOT NULL DEFAULT 0
);

-- Language-independent facts about a document.
CREATE TABLE IF NOT EXISTS documents (
  id               text PRIMARY KEY,             -- URL slug, e.g. "driving-licence"
  category_id      text NOT NULL REFERENCES categories(id),
  icon             text NOT NULL DEFAULT 'doc',
  portal_url       text NOT NULL,
  helpline         text,
  aliases          text[] NOT NULL DEFAULT '{}', -- extra search terms ("adhaar", "dl")
  youtube_queries  text[] NOT NULL DEFAULT '{}',
  -- One entry per step: NULL = no link, 'portal' = official portal, otherwise a domain.
  step_links       text[] NOT NULL DEFAULT '{}',
  popular          boolean NOT NULL DEFAULT false,
  sort_order       int NOT NULL DEFAULT 0,
  published        boolean NOT NULL DEFAULT true,
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- Everything a reader sees about a document, per language.
CREATE TABLE IF NOT EXISTS document_translations (
  document_id    text NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  lang_code      text NOT NULL REFERENCES languages(code) ON DELETE CASCADE,
  name           text NOT NULL,
  issuer         text NOT NULL,
  fee            text NOT NULL,
  time_text      text NOT NULL,
  mode           text NOT NULL,
  eligibility    text NOT NULL,
  required_docs  jsonb NOT NULL DEFAULT '[]',    -- ["Proof of address: ...", ...]
  steps          jsonb NOT NULL DEFAULT '[]',    -- [{"t": title, "d": details, "w"?: place label}]
  tips           jsonb NOT NULL DEFAULT '[]',
  updated_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (document_id, lang_code)
);

-- Accounts ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS users (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name           text NOT NULL,
  email          text NOT NULL UNIQUE,
  password_hash  text NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- Only a SHA-256 of each session token is stored.
CREATE TABLE IF NOT EXISTS sessions (
  token_hash  text PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at  timestamptz NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id);

CREATE TABLE IF NOT EXISTS saved_documents (
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  document_id  text NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  created_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, document_id)
);

CREATE TABLE IF NOT EXISTS step_progress (
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  document_id  text NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  completed    int[] NOT NULL DEFAULT '{}',      -- zero-based step indexes
  updated_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, document_id)
);

-- Per-account preferences and where the user left off (added later; safe to re-run).
ALTER TABLE users ADD COLUMN IF NOT EXISTS preferred_lang text REFERENCES languages(code) ON DELETE SET NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS theme text CHECK (theme IN ('light', 'dark'));
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_document_id text REFERENCES documents(id) ON DELETE SET NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_seen_at timestamptz;
