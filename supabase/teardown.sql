-- ============================================================
-- Amityx — T-005 teardown / rollback (NOT a migration — kept out of migrations/)
--
-- Safe-forward rollback for the greenfield tenancy schema: drops every object the
-- four T-005 migrations create, in reverse dependency order, each guarded with
-- IF EXISTS so it is idempotent and never errors on a partial apply.
--
-- Because the DB is greenfield (no production rows — see T-005 §Assumes), this is
-- a full teardown: run it, then re-run the migrations to rebuild from clean.
--
-- Apply: paste into Supabase Dashboard → SQL Editor, or
--        `psql "$DB_URL" -f supabase/teardown.sql` once a DB password/URL exists.
-- ============================================================

-- ─── RPCs + trigger/helper functions ─────────────────────────
DROP FUNCTION IF EXISTS public.resolve_guardian_link(text);
DROP FUNCTION IF EXISTS public.issue_guardian_link(uuid, integer);
DROP FUNCTION IF EXISTS public.fn_booking_request_guard() CASCADE;
DROP FUNCTION IF EXISTS public.fn_support_grant_audit()   CASCADE;
DROP FUNCTION IF EXISTS public.fn_set_updated_at()        CASCADE;
DROP FUNCTION IF EXISTS public.auth_hub_ids();
DROP FUNCTION IF EXISTS public.auth_owned_hub_ids();
DROP FUNCTION IF EXISTS public.auth_support_hub_ids();
DROP FUNCTION IF EXISTS public.auth_read_hub_ids();
DROP FUNCTION IF EXISTS public.is_crm_admin();

-- ─── Tables (CASCADE drops policies, triggers, FKs, indexes) ──
DROP TABLE IF EXISTS platform_access_audit    CASCADE;
DROP TABLE IF EXISTS platform_support_grants  CASCADE;
DROP TABLE IF EXISTS crm_comm_log             CASCADE;
DROP TABLE IF EXISTS crm_followups            CASCADE;
DROP TABLE IF EXISTS crm_hub_profiles         CASCADE;
DROP TABLE IF EXISTS crm_admins               CASCADE;
DROP TABLE IF EXISTS guardian_links           CASCADE;
DROP TABLE IF EXISTS child_notes              CASCADE;
DROP TABLE IF EXISTS attendance               CASCADE;
DROP TABLE IF EXISTS photo_moments            CASCADE;
DROP TABLE IF EXISTS announcements            CASCADE;
DROP TABLE IF EXISTS booking_requests         CASCADE;
DROP TABLE IF EXISTS enrollments              CASCADE;
DROP TABLE IF EXISTS child_guardians          CASCADE;
DROP TABLE IF EXISTS guardians                CASCADE;
DROP TABLE IF EXISTS children                 CASCADE;
DROP TABLE IF EXISTS class_sessions           CASCADE;
DROP TABLE IF EXISTS programs                 CASCADE;
DROP TABLE IF EXISTS hub_members              CASCADE;
DROP TABLE IF EXISTS hubs                     CASCADE;

-- ─── Enums ───────────────────────────────────────────────────
DROP TYPE IF EXISTS platform_access_action;
DROP TYPE IF EXISTS crm_comm_type;
DROP TYPE IF EXISTS crm_followup_status;
DROP TYPE IF EXISTS crm_priority;
DROP TYPE IF EXISTS crm_onboarding_stage;
DROP TYPE IF EXISTS crm_subscription_status;
DROP TYPE IF EXISTS enrollment_status;
DROP TYPE IF EXISTS booking_status;
DROP TYPE IF EXISTS program_type;
DROP TYPE IF EXISTS hub_role;

-- pgcrypto is left installed (harmless, may be shared by other features).
