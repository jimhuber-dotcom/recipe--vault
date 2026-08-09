#!/usr/bin/env bash
# Recipe Vault — Docker-free migration validation.
#
# FALLBACK ONLY. The authoritative check is `supabase db reset` against the
# local Docker stack, which runs the real Supabase image (auth schema, RLS,
# storage, the correct Postgres minor version). Use that whenever Docker is
# available.
#
# This script replays every migration in order against a plain PostgreSQL
# database to catch syntax errors, ordering errors, bad references, and
# constraint mistakes in environments where Docker cannot run.
#
# It installs a minimal `auth` schema shim so that migrations referencing
# auth.users / auth.uid() parse. The shim is a stand-in, NOT the real Supabase
# auth schema — passing here does not substitute for a Docker reset.
#
# Usage: ./scripts/validate-migrations.sh

set -euo pipefail

DB="recipe_vault_validate"
MIGRATIONS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/supabase/migrations"
PSQL="psql -v ON_ERROR_STOP=1 --quiet"

run_as_pg() { su postgres -c "$1"; }

echo "==> Dropping and recreating $DB"
run_as_pg "psql -tAc 'DROP DATABASE IF EXISTS $DB;'"
run_as_pg "psql -tAc 'CREATE DATABASE $DB;'"

echo "==> Installing extensions and auth shim"
run_as_pg "$PSQL -d $DB" <<'SQL'
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Minimal stand-in for Supabase's auth schema. Shim only.
CREATE SCHEMA IF NOT EXISTS auth;
CREATE TABLE IF NOT EXISTS auth.users (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email              text UNIQUE,
  raw_user_meta_data jsonb DEFAULT '{}'::jsonb,
  created_at         timestamptz DEFAULT now()
);
-- Mirrors Supabase's behaviour closely enough to exercise RLS: the caller sets
-- request.jwt.claim.sub to impersonate a user.
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid
  LANGUAGE sql STABLE AS $$
    SELECT NULLIF(
      COALESCE(
        current_setting('request.jwt.claim.sub', true),
        (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
      ), '')::uuid $$;
CREATE OR REPLACE FUNCTION auth.role() RETURNS text
  LANGUAGE sql STABLE AS $$
    SELECT NULLIF(current_setting('request.jwt.claim.role', true), '') $$;

DO $$ BEGIN
  CREATE ROLE anon NOLOGIN NOINHERIT;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE ROLE authenticated NOLOGIN NOINHERIT;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE ROLE service_role NOLOGIN NOINHERIT BYPASSRLS;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Minimal stand-in for Supabase's storage schema. Shim only.
CREATE SCHEMA IF NOT EXISTS storage;
CREATE TABLE IF NOT EXISTS storage.buckets (
  id                 text PRIMARY KEY,
  name               text NOT NULL,
  public             boolean DEFAULT false,
  file_size_limit    bigint,
  allowed_mime_types text[],
  created_at         timestamptz DEFAULT now()
);
CREATE TABLE IF NOT EXISTS storage.objects (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_id  text REFERENCES storage.buckets(id),
  name       text,
  owner      uuid,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION storage.foldername(name text) RETURNS text[]
  LANGUAGE sql IMMUTABLE AS $$
    SELECT string_to_array(name, '/') $$;
SQL

shopt -s nullglob
migrations=("$MIGRATIONS_DIR"/*.sql)
if [ ${#migrations[@]} -eq 0 ]; then
  echo "==> No migrations found in $MIGRATIONS_DIR — nothing to validate."
  exit 0
fi

for f in "${migrations[@]}"; do
  echo "==> Applying $(basename "$f")"
  cp "$f" /tmp/_mig.sql
  chmod 644 /tmp/_mig.sql
  run_as_pg "$PSQL -d $DB -f /tmp/_mig.sql"
done
rm -f /tmp/_mig.sql

echo "==> Applied ${#migrations[@]} migration(s) cleanly. Resulting objects:"
run_as_pg "psql -d $DB -c '\dt public.*'"

echo "==> Validation complete (fallback harness — still requires a Docker reset)."
