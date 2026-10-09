CREATE TABLE IF NOT EXISTS oauth_states (
  state_hash TEXT PRIMARY KEY,
  code_verifier TEXT NOT NULL,
  frontend_origin TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  github_user_id INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  arxiv_id TEXT NOT NULL,
  dispatch_token_hash TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'succeeded', 'failed')),
  stage TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  source_version TEXT,
  error TEXT,
  input_tokens INTEGER,
  output_tokens INTEGER,
  estimated_usd REAL
);

CREATE UNIQUE INDEX IF NOT EXISTS one_active_job ON jobs ((1))
  WHERE status IN ('queued', 'running');
CREATE INDEX IF NOT EXISTS jobs_arxiv_created ON jobs (arxiv_id, created_at DESC);
CREATE INDEX IF NOT EXISTS jobs_created ON jobs (created_at);

CREATE TABLE IF NOT EXISTS reports (
  arxiv_id TEXT PRIMARY KEY,
  source_version TEXT NOT NULL,
  report_json TEXT NOT NULL,
  job_id TEXT NOT NULL,
  published_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS reports_published ON reports (published_at DESC);

CREATE TABLE IF NOT EXISTS callback_nonces (
  nonce TEXT PRIMARY KEY,
  used_at INTEGER NOT NULL
);
