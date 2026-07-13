-- ============================================================
-- Amityx — CRM (platform-scoped) + platform support-access (T-005)
-- crm_* tables are NOT tenant-scoped and are reachable ONLY by platform staff
-- (crm_admins). No hub role can ever read them (proven by the adversarial suite).
-- Platform support INTO a hub is an explicit, time-boxed grant row + an
-- append-only audit log (policies/trigger in rls_grants_policies_triggers).
--
-- RLS is ENABLED + FORCED here (deny-by-default); policies come later.
-- Idempotent: CREATE ... IF NOT EXISTS + guarded enum blocks. Greenfield DB.
-- ============================================================

-- ─── CRM enums ───────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE crm_subscription_status AS ENUM ('free','trial','active','paused','canceled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE crm_onboarding_stage AS ENUM ('signup','activated','first_booking','first_kiosk','paid','churned');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE crm_priority AS ENUM ('low','normal','high');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE crm_followup_status AS ENUM ('open','done','snoozed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE crm_comm_type AS ENUM ('call','email','meeting','note');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE platform_access_action AS ENUM ('granted','revoked','expired');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── 15. crm_admins (platform staff registry) ────────────────
-- Membership here is the ONLY key to the CRM surface. Seeded via service_role.
CREATE TABLE IF NOT EXISTS crm_admins (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  name       text NOT NULL,
  email      text NOT NULL,
  role       text NOT NULL DEFAULT 'platform_admin',
  is_active  boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE crm_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_admins FORCE  ROW LEVEL SECURITY;

-- ─── 16. crm_hub_profiles (sales/onboarding pipeline per hub) ─
CREATE TABLE IF NOT EXISTS crm_hub_profiles (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hub_id              uuid NOT NULL UNIQUE REFERENCES hubs(id) ON DELETE CASCADE,
  subscription_status crm_subscription_status NOT NULL DEFAULT 'free',
  onboarding_stage    crm_onboarding_stage    NOT NULL DEFAULT 'signup',
  priority            crm_priority            NOT NULL DEFAULT 'normal',
  mrr_cents           integer NOT NULL DEFAULT 0,
  owner_name          text,
  owner_email         text,
  trial_end_date      date,
  next_follow_up_date date,
  notes               text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_crm_hub_profiles_stage    ON crm_hub_profiles (onboarding_stage);
CREATE INDEX IF NOT EXISTS idx_crm_hub_profiles_followup ON crm_hub_profiles (next_follow_up_date) WHERE next_follow_up_date IS NOT NULL;
ALTER TABLE crm_hub_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_hub_profiles FORCE  ROW LEVEL SECURITY;

-- ─── 17. crm_followups ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS crm_followups (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hub_id      uuid NOT NULL REFERENCES hubs(id) ON DELETE CASCADE,
  description text NOT NULL,
  due_date    date NOT NULL,
  status      crm_followup_status NOT NULL DEFAULT 'open',
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_crm_followups_hub  ON crm_followups (hub_id, due_date);
CREATE INDEX IF NOT EXISTS idx_crm_followups_open ON crm_followups (due_date) WHERE status = 'open';
ALTER TABLE crm_followups ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_followups FORCE  ROW LEVEL SECURITY;

-- ─── 18. crm_comm_log ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS crm_comm_log (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hub_id     uuid NOT NULL REFERENCES hubs(id) ON DELETE CASCADE,
  comm_type  crm_comm_type NOT NULL,
  content    text NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_crm_comm_log_hub ON crm_comm_log (hub_id, created_at DESC);
ALTER TABLE crm_comm_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_comm_log FORCE  ROW LEVEL SECURITY;

-- ─── 19. platform_support_grants (explicit, time-boxed) ──────
-- A crm_admin must hold an ACTIVE (not revoked, not expired) grant to read a
-- hub's tenant data. Grants never confer write access to hub data.
CREATE TABLE IF NOT EXISTS platform_support_grants (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hub_id     uuid NOT NULL REFERENCES hubs(id) ON DELETE CASCADE,
  admin_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason     text NOT NULL,
  granted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  granted_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,           -- REQUIRED time-box
  revoked_at timestamptz,
  revoked_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_support_grants_admin_active
  ON platform_support_grants (admin_id, hub_id)
  WHERE revoked_at IS NULL;
ALTER TABLE platform_support_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_support_grants FORCE  ROW LEVEL SECURITY;

-- ─── 20. platform_access_audit (append-only) ─────────────────
-- Written ONLY by the grant-lifecycle trigger (SECURITY DEFINER). No UPDATE or
-- DELETE is ever permitted (revoked in the policies migration).
CREATE TABLE IF NOT EXISTS platform_access_audit (
  id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grant_id uuid,
  hub_id   uuid,
  admin_id uuid,
  action   platform_access_action NOT NULL,
  detail   jsonb,
  at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_platform_access_audit_hub ON platform_access_audit (hub_id, at DESC);
ALTER TABLE platform_access_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_access_audit FORCE  ROW LEVEL SECURITY;
