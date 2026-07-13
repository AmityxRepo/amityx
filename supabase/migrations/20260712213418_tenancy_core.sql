-- ============================================================
-- Amityx — Tenancy core schema (T-005)
-- Tenant = hub. Every tenant table carries hub_id NOT NULL.
-- RLS is ENABLED + FORCED on every table in THIS migration so a table is
-- never reachable without a policy, even between migrations (deny-by-default).
-- Policies, grants and triggers live in the rls_grants_policies_triggers
-- migration; RPCs in guardian_link_rpcs. Splitting keeps the blast radius
-- reviewable while never leaving a table RLS-off.
--
-- Idempotent: safe to re-run. Uses CREATE ... IF NOT EXISTS / guarded DO blocks
-- for enums. Greenfield DB assumed (no existing rows) — see supabase/ROLLBACK.md.
-- ============================================================

-- ─── Extensions ──────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- gen_random_uuid(), gen_random_bytes(), digest()

-- ─── Enums (guarded for idempotent re-run) ───────────────────
DO $$ BEGIN
  CREATE TYPE hub_role         AS ENUM ('owner', 'staff');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE program_type     AS ENUM ('art','swim','karate','daycare','bootcamp','open_play','camp');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE booking_status   AS ENUM ('new','contacted','enrolled','declined','archived');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE enrollment_status AS ENUM ('active','waitlisted','completed','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── 1. hubs (tenant root) ───────────────────────────────────
CREATE TABLE IF NOT EXISTS hubs (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                   text NOT NULL,
  slug                   text NOT NULL UNIQUE,                 -- public booking page URL segment
  public_booking_enabled boolean NOT NULL DEFAULT true,
  timezone               text NOT NULL DEFAULT 'America/Los_Angeles',
  address                text,
  city                   text,
  state                  text DEFAULT 'CA',
  -- billing / settings columns — OWNER-ONLY (hub_staff must never write these; see policies)
  plan                   text NOT NULL DEFAULT 'free',         -- free | ops
  stripe_customer_id     text,
  settings               jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at             timestamptz NOT NULL DEFAULT now(),
  created_by             uuid REFERENCES auth.users(id) ON DELETE SET NULL
);
ALTER TABLE hubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE hubs FORCE  ROW LEVEL SECURITY;

-- ─── 2. hub_members (user ↔ hub) ─────────────────────────────
CREATE TABLE IF NOT EXISTS hub_members (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hub_id     uuid NOT NULL REFERENCES hubs(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role       hub_role NOT NULL DEFAULT 'staff',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (hub_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_hub_members_user ON hub_members (user_id);
CREATE INDEX IF NOT EXISTS idx_hub_members_hub  ON hub_members (hub_id);
ALTER TABLE hub_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE hub_members FORCE  ROW LEVEL SECURITY;

-- ─── 3. programs (template-seeded activities) ────────────────
CREATE TABLE IF NOT EXISTS programs (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hub_id         uuid NOT NULL REFERENCES hubs(id) ON DELETE CASCADE,
  type           program_type NOT NULL,
  name           text NOT NULL,
  description    text,
  age_min_months smallint,
  age_max_months smallint,
  capacity       smallint,
  active         boolean NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_programs_hub ON programs (hub_id) WHERE active = true;
ALTER TABLE programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE programs FORCE  ROW LEVEL SECURITY;

-- ─── 4. class_sessions (schedule instances) ──────────────────
CREATE TABLE IF NOT EXISTS class_sessions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hub_id     uuid NOT NULL REFERENCES hubs(id) ON DELETE CASCADE,
  program_id uuid NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  starts_at  timestamptz NOT NULL,
  ends_at    timestamptz,
  capacity   smallint,
  location   text,
  active     boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sessions_hub_time ON class_sessions (hub_id, starts_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_program  ON class_sessions (program_id, starts_at DESC);
ALTER TABLE class_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_sessions FORCE  ROW LEVEL SECURITY;

-- ─── 5. children (photo_consent per child, D-009) ────────────
CREATE TABLE IF NOT EXISTS children (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hub_id        uuid NOT NULL REFERENCES hubs(id) ON DELETE CASCADE,
  display_name  text NOT NULL,
  birthdate     date,
  photo_consent boolean NOT NULL DEFAULT false,  -- gates parent-portal visibility (D-009)
  active        boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_children_hub ON children (hub_id) WHERE active = true;
ALTER TABLE children ENABLE ROW LEVEL SECURITY;
ALTER TABLE children FORCE  ROW LEVEL SECURITY;

-- ─── 6. guardians ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS guardians (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hub_id       uuid NOT NULL REFERENCES hubs(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  email        text,
  phone        text,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_guardians_hub ON guardians (hub_id);
ALTER TABLE guardians ENABLE ROW LEVEL SECURITY;
ALTER TABLE guardians FORCE  ROW LEVEL SECURITY;

-- ─── 7. child_guardians (join) ───────────────────────────────
CREATE TABLE IF NOT EXISTS child_guardians (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hub_id       uuid NOT NULL REFERENCES hubs(id) ON DELETE CASCADE,
  child_id     uuid NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  guardian_id  uuid NOT NULL REFERENCES guardians(id) ON DELETE CASCADE,
  relationship text,
  is_primary   boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (child_id, guardian_id)
);
CREATE INDEX IF NOT EXISTS idx_child_guardians_guardian ON child_guardians (guardian_id);
CREATE INDEX IF NOT EXISTS idx_child_guardians_child    ON child_guardians (child_id);
ALTER TABLE child_guardians ENABLE ROW LEVEL SECURITY;
ALTER TABLE child_guardians FORCE  ROW LEVEL SECURITY;

-- ─── 8. enrollments (roster: child ↔ program/session) ────────
CREATE TABLE IF NOT EXISTS enrollments (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hub_id             uuid NOT NULL REFERENCES hubs(id) ON DELETE CASCADE,
  child_id           uuid NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  program_id         uuid REFERENCES programs(id) ON DELETE SET NULL,
  session_id         uuid REFERENCES class_sessions(id) ON DELETE SET NULL,
  status             enrollment_status NOT NULL DEFAULT 'active',
  booking_request_id uuid,  -- FK added after booking_requests exists (below)
  created_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_enrollments_hub     ON enrollments (hub_id, status);
CREATE INDEX IF NOT EXISTS idx_enrollments_child   ON enrollments (child_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_program ON enrollments (program_id);
ALTER TABLE enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrollments FORCE  ROW LEVEL SECURITY;

-- ─── 9. booking_requests (public page → roster pipeline) ─────
CREATE TABLE IF NOT EXISTS booking_requests (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hub_id         uuid NOT NULL REFERENCES hubs(id) ON DELETE CASCADE,
  program_id     uuid REFERENCES programs(id) ON DELETE SET NULL,
  session_id     uuid REFERENCES class_sessions(id) ON DELETE SET NULL,
  child_name     text NOT NULL,
  child_birthdate date,
  guardian_name  text NOT NULL,
  guardian_email text NOT NULL,
  guardian_phone text,
  message        text,
  status         booking_status NOT NULL DEFAULT 'new',
  source         text NOT NULL DEFAULT 'public_page',
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_booking_requests_hub  ON booking_requests (hub_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_booking_requests_rate ON booking_requests (hub_id, created_at);  -- rate-limit trigger
ALTER TABLE booking_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_requests FORCE  ROW LEVEL SECURITY;

-- Deferred FK: enrollment may originate from a booking_request.
DO $$ BEGIN
  ALTER TABLE enrollments
    ADD CONSTRAINT enrollments_booking_request_fk
    FOREIGN KEY (booking_request_id) REFERENCES booking_requests(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── 10. announcements (aggregate read counts, R-003) ────────
CREATE TABLE IF NOT EXISTS announcements (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hub_id       uuid NOT NULL REFERENCES hubs(id) ON DELETE CASCADE,
  title        text NOT NULL,
  body         text NOT NULL DEFAULT '',
  published_at timestamptz,
  read_count   integer NOT NULL DEFAULT 0,   -- aggregate only; NO per-recipient rows (R-003)
  created_by   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_announcements_hub ON announcements (hub_id, created_at DESC);
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements FORCE  ROW LEVEL SECURITY;

-- ─── 11. photo_moments (media METADATA only, D-011) ──────────
CREATE TABLE IF NOT EXISTS photo_moments (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hub_id       uuid NOT NULL REFERENCES hubs(id) ON DELETE CASCADE,
  child_id     uuid REFERENCES children(id) ON DELETE CASCADE,   -- null = group moment
  session_id   uuid REFERENCES class_sessions(id) ON DELETE SET NULL,
  storage_path text NOT NULL,       -- adapter-backed; bytes handled in T-011
  caption      text,
  taken_at     timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz,         -- 30-day free window (D-009); enforced by T-011
  created_by   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_photo_moments_hub   ON photo_moments (hub_id, taken_at DESC);
CREATE INDEX IF NOT EXISTS idx_photo_moments_child ON photo_moments (child_id, taken_at DESC) WHERE child_id IS NOT NULL;
ALTER TABLE photo_moments ENABLE ROW LEVEL SECURITY;
ALTER TABLE photo_moments FORCE  ROW LEVEL SECURITY;

-- ─── 12. attendance (kiosk check-in/out per session per child) ─
CREATE TABLE IF NOT EXISTS attendance (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hub_id         uuid NOT NULL REFERENCES hubs(id) ON DELETE CASCADE,
  session_id     uuid NOT NULL REFERENCES class_sessions(id) ON DELETE CASCADE,
  child_id       uuid NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  checked_in_at  timestamptz NOT NULL DEFAULT now(),
  checked_out_at timestamptz,
  method         text NOT NULL DEFAULT 'kiosk',   -- kiosk | staff
  checked_in_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE (session_id, child_id)
);
CREATE INDEX IF NOT EXISTS idx_attendance_hub_session ON attendance (hub_id, session_id);
CREATE INDEX IF NOT EXISTS idx_attendance_child       ON attendance (child_id, checked_in_at DESC);
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance FORCE  ROW LEVEL SECURITY;

-- ─── 13. child_notes (daily notes; guardian visibility RESERVED) ─
CREATE TABLE IF NOT EXISTS child_notes (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hub_id             uuid NOT NULL REFERENCES hubs(id) ON DELETE CASCADE,
  child_id           uuid NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  session_id         uuid REFERENCES class_sessions(id) ON DELETE SET NULL,
  body               text NOT NULL DEFAULT '',
  visible_to_guardian boolean NOT NULL DEFAULT false,  -- reserved for Phase-2 parent portal
  created_by         uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_child_notes_child ON child_notes (child_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_child_notes_hub   ON child_notes (hub_id, created_at DESC);
ALTER TABLE child_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE child_notes FORCE  ROW LEVEL SECURITY;

-- ─── 14. guardian_links (signed, scoped, expiring parent tokens) ─
-- Only a SHA-256 hash of the token is stored; the raw token lives only in the
-- emailed link (D-014). Resolution + issuance happen via SECURITY DEFINER RPCs
-- (guardian_link_rpcs migration). No broad anon RLS on child tables.
CREATE TABLE IF NOT EXISTS guardian_links (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hub_id       uuid NOT NULL REFERENCES hubs(id) ON DELETE CASCADE,
  guardian_id  uuid NOT NULL REFERENCES guardians(id) ON DELETE CASCADE,
  token_hash   text NOT NULL UNIQUE,            -- hex sha256 of the raw token
  expires_at   timestamptz NOT NULL,
  revoked_at   timestamptz,
  last_used_at timestamptz,
  created_by   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_guardian_links_guardian ON guardian_links (guardian_id);
CREATE INDEX IF NOT EXISTS idx_guardian_links_hub      ON guardian_links (hub_id);
ALTER TABLE guardian_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE guardian_links FORCE  ROW LEVEL SECURITY;
