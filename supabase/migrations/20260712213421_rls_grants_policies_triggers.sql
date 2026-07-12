-- ============================================================
-- Amityx — RLS helpers, grants, policies, triggers (T-005)
--
-- Security model (deny-by-default; every table has RLS ENABLED + FORCED already):
--   • Tenant tables: READ  = hub members OR an active platform support grant
--                    WRITE = hub members only (support access is read/observe only)
--   • hubs / hub_members WRITE = hub OWNERS only (staff never touch billing/settings)
--   • crm_*  = platform staff (crm_admins) only — no hub role can reach them
--   • booking_requests = anon INSERT only (validated + rate-limited by a trigger);
--                        NO anon SELECT anywhere
--   • platform_access_audit = append-only (INSERT via trigger; no UPDATE/DELETE)
--
-- Membership/role/support lookups go through SECURITY DEFINER helpers so RLS on
-- hub_members can reference hub_members without infinite recursion.
-- Idempotent: CREATE OR REPLACE for functions; DROP POLICY IF EXISTS before each
-- CREATE POLICY; DROP TRIGGER IF EXISTS before each CREATE TRIGGER.
-- ============================================================

-- ════════════════════════════════════════════════════════════
-- 1. HELPER FUNCTIONS (SECURITY DEFINER, pinned search_path)
-- ════════════════════════════════════════════════════════════

-- Hub ids where the current user is a member (owner OR staff) → WRITE gate.
CREATE OR REPLACE FUNCTION public.auth_hub_ids()
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT hub_id FROM public.hub_members WHERE user_id = auth.uid()
$$;

-- Hub ids the current user OWNS → hubs/hub_members write gate (billing/settings).
CREATE OR REPLACE FUNCTION public.auth_owned_hub_ids()
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT hub_id FROM public.hub_members WHERE user_id = auth.uid() AND role = 'owner'
$$;

-- Hub ids the current user may access via an ACTIVE, time-boxed support grant.
CREATE OR REPLACE FUNCTION public.auth_support_hub_ids()
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT hub_id FROM public.platform_support_grants
   WHERE admin_id = auth.uid()
     AND revoked_at IS NULL
     AND expires_at > now()
$$;

-- Hub ids the current user may READ = membership ∪ active support grants.
CREATE OR REPLACE FUNCTION public.auth_read_hub_ids()
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT hub_id FROM public.hub_members WHERE user_id = auth.uid()
  UNION
  SELECT hub_id FROM public.platform_support_grants
   WHERE admin_id = auth.uid() AND revoked_at IS NULL AND expires_at > now()
$$;

-- Is the current user an active platform (CRM) admin?
CREATE OR REPLACE FUNCTION public.is_crm_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.crm_admins WHERE user_id = auth.uid() AND is_active = true
  )
$$;

REVOKE EXECUTE ON FUNCTION public.auth_hub_ids()         FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.auth_owned_hub_ids()   FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.auth_support_hub_ids() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.auth_read_hub_ids()    FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_crm_admin()         FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.auth_hub_ids()         TO authenticated;
GRANT  EXECUTE ON FUNCTION public.auth_owned_hub_ids()   TO authenticated;
GRANT  EXECUTE ON FUNCTION public.auth_support_hub_ids() TO authenticated;
GRANT  EXECUTE ON FUNCTION public.auth_read_hub_ids()    TO authenticated;
GRANT  EXECUTE ON FUNCTION public.is_crm_admin()         TO authenticated;

-- ════════════════════════════════════════════════════════════
-- 2. GRANTS (PostgREST needs table grants BEFORE RLS is evaluated)
--    Supabase does NOT auto-expose new tables, so grants are explicit.
--    anon gets exactly ONE capability: INSERT into booking_requests.
-- ════════════════════════════════════════════════════════════

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- service_role: full access on every table (bypasses RLS; used by seeds/tests only).
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO service_role;

-- authenticated: CRUD on tenant + crm tables (RLS narrows to the right rows/roles).
GRANT SELECT, INSERT, UPDATE, DELETE ON
  hubs, hub_members, programs, class_sessions, children, guardians, child_guardians,
  enrollments, booking_requests, announcements, photo_moments, attendance, child_notes,
  guardian_links, crm_hub_profiles, crm_followups, crm_comm_log, platform_support_grants
  TO authenticated;

-- Read-only-for-authenticated tables (writes are service_role or trigger only).
GRANT SELECT ON crm_admins            TO authenticated;
GRANT SELECT ON platform_access_audit TO authenticated;

-- Append-only audit: no authenticated mutation, ever.
REVOKE INSERT, UPDATE, DELETE ON platform_access_audit FROM authenticated;

-- anon: booking_requests INSERT only. Nothing else.
GRANT INSERT ON booking_requests TO anon;

-- ════════════════════════════════════════════════════════════
-- 3. POLICIES
-- ════════════════════════════════════════════════════════════

-- ─── hubs: read = members+support; write = OWNERS only; no client INSERT ──
DROP POLICY IF EXISTS hubs_read        ON hubs;
DROP POLICY IF EXISTS hubs_owner_write ON hubs;
CREATE POLICY hubs_read ON hubs
  FOR SELECT TO authenticated
  USING (id IN (SELECT auth_read_hub_ids()));
CREATE POLICY hubs_owner_write ON hubs
  FOR UPDATE TO authenticated
  USING (id IN (SELECT auth_owned_hub_ids()))
  WITH CHECK (id IN (SELECT auth_owned_hub_ids()));
-- (No INSERT/DELETE policy: hub creation is a service_role / signup-RPC concern.)

-- ─── hub_members: read = members+support; write = OWNERS only ────────────
DROP POLICY IF EXISTS hub_members_read        ON hub_members;
DROP POLICY IF EXISTS hub_members_owner_write ON hub_members;
CREATE POLICY hub_members_read ON hub_members
  FOR SELECT TO authenticated
  USING (hub_id IN (SELECT auth_read_hub_ids()));
CREATE POLICY hub_members_owner_write ON hub_members
  FOR ALL TO authenticated
  USING (hub_id IN (SELECT auth_owned_hub_ids()))
  WITH CHECK (hub_id IN (SELECT auth_owned_hub_ids()));

-- ─── Standard tenant tables: read = members+support; write = members ─────
-- programs
DROP POLICY IF EXISTS programs_read  ON programs;
DROP POLICY IF EXISTS programs_write ON programs;
CREATE POLICY programs_read  ON programs FOR SELECT TO authenticated
  USING (hub_id IN (SELECT auth_read_hub_ids()));
CREATE POLICY programs_write ON programs FOR ALL TO authenticated
  USING (hub_id IN (SELECT auth_hub_ids())) WITH CHECK (hub_id IN (SELECT auth_hub_ids()));

-- class_sessions
DROP POLICY IF EXISTS class_sessions_read  ON class_sessions;
DROP POLICY IF EXISTS class_sessions_write ON class_sessions;
CREATE POLICY class_sessions_read  ON class_sessions FOR SELECT TO authenticated
  USING (hub_id IN (SELECT auth_read_hub_ids()));
CREATE POLICY class_sessions_write ON class_sessions FOR ALL TO authenticated
  USING (hub_id IN (SELECT auth_hub_ids())) WITH CHECK (hub_id IN (SELECT auth_hub_ids()));

-- children
DROP POLICY IF EXISTS children_read  ON children;
DROP POLICY IF EXISTS children_write ON children;
CREATE POLICY children_read  ON children FOR SELECT TO authenticated
  USING (hub_id IN (SELECT auth_read_hub_ids()));
CREATE POLICY children_write ON children FOR ALL TO authenticated
  USING (hub_id IN (SELECT auth_hub_ids())) WITH CHECK (hub_id IN (SELECT auth_hub_ids()));

-- guardians
DROP POLICY IF EXISTS guardians_read  ON guardians;
DROP POLICY IF EXISTS guardians_write ON guardians;
CREATE POLICY guardians_read  ON guardians FOR SELECT TO authenticated
  USING (hub_id IN (SELECT auth_read_hub_ids()));
CREATE POLICY guardians_write ON guardians FOR ALL TO authenticated
  USING (hub_id IN (SELECT auth_hub_ids())) WITH CHECK (hub_id IN (SELECT auth_hub_ids()));

-- child_guardians
DROP POLICY IF EXISTS child_guardians_read  ON child_guardians;
DROP POLICY IF EXISTS child_guardians_write ON child_guardians;
CREATE POLICY child_guardians_read  ON child_guardians FOR SELECT TO authenticated
  USING (hub_id IN (SELECT auth_read_hub_ids()));
CREATE POLICY child_guardians_write ON child_guardians FOR ALL TO authenticated
  USING (hub_id IN (SELECT auth_hub_ids())) WITH CHECK (hub_id IN (SELECT auth_hub_ids()));

-- enrollments
DROP POLICY IF EXISTS enrollments_read  ON enrollments;
DROP POLICY IF EXISTS enrollments_write ON enrollments;
CREATE POLICY enrollments_read  ON enrollments FOR SELECT TO authenticated
  USING (hub_id IN (SELECT auth_read_hub_ids()));
CREATE POLICY enrollments_write ON enrollments FOR ALL TO authenticated
  USING (hub_id IN (SELECT auth_hub_ids())) WITH CHECK (hub_id IN (SELECT auth_hub_ids()));

-- announcements
DROP POLICY IF EXISTS announcements_read  ON announcements;
DROP POLICY IF EXISTS announcements_write ON announcements;
CREATE POLICY announcements_read  ON announcements FOR SELECT TO authenticated
  USING (hub_id IN (SELECT auth_read_hub_ids()));
CREATE POLICY announcements_write ON announcements FOR ALL TO authenticated
  USING (hub_id IN (SELECT auth_hub_ids())) WITH CHECK (hub_id IN (SELECT auth_hub_ids()));

-- photo_moments
DROP POLICY IF EXISTS photo_moments_read  ON photo_moments;
DROP POLICY IF EXISTS photo_moments_write ON photo_moments;
CREATE POLICY photo_moments_read  ON photo_moments FOR SELECT TO authenticated
  USING (hub_id IN (SELECT auth_read_hub_ids()));
CREATE POLICY photo_moments_write ON photo_moments FOR ALL TO authenticated
  USING (hub_id IN (SELECT auth_hub_ids())) WITH CHECK (hub_id IN (SELECT auth_hub_ids()));

-- attendance
DROP POLICY IF EXISTS attendance_read  ON attendance;
DROP POLICY IF EXISTS attendance_write ON attendance;
CREATE POLICY attendance_read  ON attendance FOR SELECT TO authenticated
  USING (hub_id IN (SELECT auth_read_hub_ids()));
CREATE POLICY attendance_write ON attendance FOR ALL TO authenticated
  USING (hub_id IN (SELECT auth_hub_ids())) WITH CHECK (hub_id IN (SELECT auth_hub_ids()));

-- child_notes
DROP POLICY IF EXISTS child_notes_read  ON child_notes;
DROP POLICY IF EXISTS child_notes_write ON child_notes;
CREATE POLICY child_notes_read  ON child_notes FOR SELECT TO authenticated
  USING (hub_id IN (SELECT auth_read_hub_ids()));
CREATE POLICY child_notes_write ON child_notes FOR ALL TO authenticated
  USING (hub_id IN (SELECT auth_hub_ids())) WITH CHECK (hub_id IN (SELECT auth_hub_ids()));

-- guardian_links: hub members manage; parents never touch the table (RPC only).
DROP POLICY IF EXISTS guardian_links_read  ON guardian_links;
DROP POLICY IF EXISTS guardian_links_write ON guardian_links;
CREATE POLICY guardian_links_read  ON guardian_links FOR SELECT TO authenticated
  USING (hub_id IN (SELECT auth_read_hub_ids()));
CREATE POLICY guardian_links_write ON guardian_links FOR ALL TO authenticated
  USING (hub_id IN (SELECT auth_hub_ids())) WITH CHECK (hub_id IN (SELECT auth_hub_ids()));

-- ─── booking_requests: anon INSERT only; owners read/manage via hub RLS ──
DROP POLICY IF EXISTS booking_requests_anon_insert ON booking_requests;
DROP POLICY IF EXISTS booking_requests_read        ON booking_requests;
DROP POLICY IF EXISTS booking_requests_write       ON booking_requests;
-- Anonymous public-page submissions. The trigger validates the hub, enforces
-- the rate limit, and forces server-controlled columns. WITH CHECK stays broad
-- because the trigger (SECURITY DEFINER) is the real gate; anon has NO SELECT.
CREATE POLICY booking_requests_anon_insert ON booking_requests
  FOR INSERT TO anon
  WITH CHECK (true);
CREATE POLICY booking_requests_read ON booking_requests
  FOR SELECT TO authenticated
  USING (hub_id IN (SELECT auth_read_hub_ids()));
CREATE POLICY booking_requests_write ON booking_requests
  FOR ALL TO authenticated
  USING (hub_id IN (SELECT auth_hub_ids()))
  WITH CHECK (hub_id IN (SELECT auth_hub_ids()));

-- ─── CRM tables: platform staff (crm_admins) ONLY ───────────────────────
DROP POLICY IF EXISTS crm_admins_read ON crm_admins;
CREATE POLICY crm_admins_read ON crm_admins
  FOR SELECT TO authenticated USING (is_crm_admin());
-- crm_admins writes are service_role-only (bootstrap) — no authenticated policy.

DROP POLICY IF EXISTS crm_hub_profiles_all ON crm_hub_profiles;
CREATE POLICY crm_hub_profiles_all ON crm_hub_profiles
  FOR ALL TO authenticated USING (is_crm_admin()) WITH CHECK (is_crm_admin());

DROP POLICY IF EXISTS crm_followups_all ON crm_followups;
CREATE POLICY crm_followups_all ON crm_followups
  FOR ALL TO authenticated USING (is_crm_admin()) WITH CHECK (is_crm_admin());

DROP POLICY IF EXISTS crm_comm_log_all ON crm_comm_log;
CREATE POLICY crm_comm_log_all ON crm_comm_log
  FOR ALL TO authenticated USING (is_crm_admin()) WITH CHECK (is_crm_admin());

-- ─── platform_support_grants: crm_admins grant/revoke; audit read ───────
DROP POLICY IF EXISTS platform_support_grants_all ON platform_support_grants;
CREATE POLICY platform_support_grants_all ON platform_support_grants
  FOR ALL TO authenticated USING (is_crm_admin()) WITH CHECK (is_crm_admin());

DROP POLICY IF EXISTS platform_access_audit_read ON platform_access_audit;
CREATE POLICY platform_access_audit_read ON platform_access_audit
  FOR SELECT TO authenticated USING (is_crm_admin());
-- No INSERT/UPDATE/DELETE policy: rows are written only by the trigger below.

-- ════════════════════════════════════════════════════════════
-- 4. TRIGGERS
-- ════════════════════════════════════════════════════════════

-- ─── booking_requests guard: validate hub + rate limit + lock columns ───
CREATE OR REPLACE FUNCTION public.fn_booking_request_guard()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_enabled boolean;
  v_count   integer;
  v_daily_cap constant integer := 50;   -- per-hub/day public submission cap
BEGIN
  SELECT public_booking_enabled INTO v_enabled FROM hubs WHERE id = NEW.hub_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'invalid_hub' USING errcode = 'check_violation';
  END IF;
  IF v_enabled IS NOT TRUE THEN
    RAISE EXCEPTION 'booking_disabled' USING errcode = 'check_violation';
  END IF;

  -- Optional program/session must belong to the SAME hub (anti-tamper).
  IF NEW.program_id IS NOT NULL AND NOT EXISTS (
       SELECT 1 FROM programs WHERE id = NEW.program_id AND hub_id = NEW.hub_id) THEN
    RAISE EXCEPTION 'invalid_program' USING errcode = 'check_violation';
  END IF;
  IF NEW.session_id IS NOT NULL AND NOT EXISTS (
       SELECT 1 FROM class_sessions WHERE id = NEW.session_id AND hub_id = NEW.hub_id) THEN
    RAISE EXCEPTION 'invalid_session' USING errcode = 'check_violation';
  END IF;

  -- Per-hub/day rate limit (spam blunting).
  SELECT count(*) INTO v_count FROM booking_requests
    WHERE hub_id = NEW.hub_id AND created_at >= date_trunc('day', now());
  IF v_count >= v_daily_cap THEN
    RAISE EXCEPTION 'rate_limited' USING errcode = 'check_violation';
  END IF;

  -- Force server-controlled fields regardless of client input.
  NEW.status     := 'new';
  NEW.created_at := now();
  IF NEW.source IS NULL THEN NEW.source := 'public_page'; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tg_booking_request_guard ON booking_requests;
CREATE TRIGGER tg_booking_request_guard
  BEFORE INSERT ON booking_requests
  FOR EACH ROW EXECUTE FUNCTION public.fn_booking_request_guard();

-- ─── platform support-grant lifecycle → append-only audit ───────────────
CREATE OR REPLACE FUNCTION public.fn_support_grant_audit()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO platform_access_audit (grant_id, hub_id, admin_id, action, detail)
    VALUES (NEW.id, NEW.hub_id, NEW.admin_id, 'granted',
            jsonb_build_object('reason', NEW.reason,
                               'expires_at', NEW.expires_at,
                               'granted_by', NEW.granted_by));
  ELSIF TG_OP = 'UPDATE' AND OLD.revoked_at IS NULL AND NEW.revoked_at IS NOT NULL THEN
    INSERT INTO platform_access_audit (grant_id, hub_id, admin_id, action, detail)
    VALUES (NEW.id, NEW.hub_id, NEW.admin_id, 'revoked',
            jsonb_build_object('revoked_by', NEW.revoked_by));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tg_support_grant_audit ON platform_support_grants;
CREATE TRIGGER tg_support_grant_audit
  AFTER INSERT OR UPDATE ON platform_support_grants
  FOR EACH ROW EXECUTE FUNCTION public.fn_support_grant_audit();

-- ─── crm_hub_profiles.updated_at maintenance ────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tg_crm_hub_profiles_updated ON crm_hub_profiles;
CREATE TRIGGER tg_crm_hub_profiles_updated
  BEFORE UPDATE ON crm_hub_profiles
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();
