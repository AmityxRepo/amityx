-- ============================================================
-- Amityx — CRM hub-metadata read fix (B-001, T-009 tester)
--
-- BUG: the /crm pipeline showed BLANK business names + booking slugs for every
-- hub. `listCrmHubs`/`getCrmHub` read the hub name via a PostgREST embed
-- (crm_hub_profiles -> hubs). The `hubs` root row is gated by `hubs_read`
-- (auth_read_hub_ids() = member ∪ active support grant). A platform admin is
-- neither, so the embed resolved to NULL and the CRM rendered empty names.
--
-- FIX (least privilege): let an ACTIVE platform admin read the hub ROOT row only
-- (name / slug / city / state / plan / timezone / booking flags — the pipeline
-- metadata the CRM needs). This does NOT touch any tenant DATA table: children,
-- guardians, child_notes, attendance, photo_moments, enrollments, etc. remain
-- member-/support-grant-gated exactly as before (proven by the adversarial RLS
-- suite, which still asserts an admin cannot read hub A children without a grant).
--
-- Additive + idempotent (DROP POLICY IF EXISTS / CREATE POLICY). No app/bundle
-- change, so no redeploy is required for this fix to take effect.
-- ============================================================

DROP POLICY IF EXISTS hubs_crm_read ON hubs;
CREATE POLICY hubs_crm_read ON hubs
  FOR SELECT TO authenticated
  USING (public.is_crm_admin());
