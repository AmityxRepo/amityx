-- ============================================================
-- Amityx — Signup provisioning + staff invites (T-006)
--
-- WHY this migration exists (the T-005 RLS model requires it):
--   hubs has NO client INSERT policy, hub_members INSERT is OWNER-only, and
--   crm_hub_profiles INSERT is crm_admin-only. A brand-new owner is none of
--   those at signup time — a pure client INSERT can never bootstrap the first
--   hub (chicken-and-egg). T-005 flagged this explicitly ("hub creation is a
--   service_role / signup-RPC concern"). So hub creation runs through ONE
--   SECURITY DEFINER function that creates the hub, the owner membership, and
--   the CRM pipeline row ATOMICALLY (single function body = single transaction),
--   keyed on auth.uid(). No service-role key ever touches the client.
--
-- Adds:
--   • slug_available(text)                     — live slug-collision check
--   • provision_hub(...)                       — atomic owner+hub+crm+programs+class
--   • hub_invites table + RLS (owner-managed)
--   • create_hub_invite / resolve_hub_invite / accept_hub_invite RPCs
--
-- Every RPC is SECURITY DEFINER with a pinned search_path (extensions added
-- where pgcrypto's gen_random_bytes/digest are used — same pattern as the
-- guardian_link RPCs). Idempotent: CREATE ... IF NOT EXISTS / CREATE OR REPLACE
-- / DROP POLICY IF EXISTS. Greenfield DB assumed.
-- ============================================================

-- ════════════════════════════════════════════════════════════
-- 1. slug_available — live collision check for the signup wizard
--    (authenticated: the hub step runs after the owner has verified + signed in)
-- ════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.slug_available(p_slug text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT lower(trim(coalesce(p_slug, ''))) ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
     AND length(lower(trim(coalesce(p_slug, '')))) BETWEEN 3 AND 40
     AND NOT EXISTS (SELECT 1 FROM public.hubs WHERE slug = lower(trim(p_slug)));
$$;
REVOKE EXECUTE ON FUNCTION public.slug_available(text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.slug_available(text) TO authenticated;

-- ════════════════════════════════════════════════════════════
-- 2. provision_hub — the ONE atomic signup transaction
--    p_activities : jsonb array of {type, name?, age_min_months?, age_max_months?}
--    p_first_class: jsonb {program_type, starts_at, ends_at?, capacity?} | null
-- ════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.provision_hub(
  p_name        text,
  p_slug        text,
  p_timezone    text  DEFAULT 'America/Los_Angeles',
  p_owner_name  text  DEFAULT NULL,
  p_activities  jsonb DEFAULT '[]'::jsonb,
  p_first_class jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid        uuid := auth.uid();
  v_email      text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_name       text := trim(coalesce(p_name, ''));
  v_slug       text := lower(trim(coalesce(p_slug, '')));
  v_hub_id     uuid;
  v_activity   jsonb;
  v_prog_type  program_type;
  v_prog_id    uuid;
  v_first_type program_type;
  v_prog_map   jsonb := '{}'::jsonb;   -- program_type -> program_id (for first-class linking)
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated');
  END IF;
  IF length(v_name) < 2 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_name');
  END IF;
  IF v_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' OR length(v_slug) < 3 OR length(v_slug) > 40 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_slug');
  END IF;
  IF EXISTS (SELECT 1 FROM hubs WHERE slug = v_slug) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'slug_taken');
  END IF;

  -- hub (tenant root)
  INSERT INTO hubs (name, slug, timezone, created_by)
  VALUES (v_name, v_slug, coalesce(nullif(trim(coalesce(p_timezone, '')), ''), 'America/Los_Angeles'), v_uid)
  RETURNING id INTO v_hub_id;

  -- owner membership
  INSERT INTO hub_members (hub_id, user_id, role) VALUES (v_hub_id, v_uid, 'owner');

  -- CRM pipeline handoff (D-007) — atomic with the hub, onboarding_stage seeded
  INSERT INTO crm_hub_profiles (hub_id, subscription_status, onboarding_stage, owner_name, owner_email)
  VALUES (v_hub_id, 'free', 'signup',
          nullif(trim(coalesce(p_owner_name, '')), ''),
          nullif(v_email, ''));

  -- activities (programs) from the template picker
  FOR v_activity IN SELECT * FROM jsonb_array_elements(coalesce(p_activities, '[]'::jsonb))
  LOOP
    BEGIN
      v_prog_type := (v_activity ->> 'type')::program_type;
    EXCEPTION WHEN others THEN
      CONTINUE;   -- silently skip an unknown/garbage type rather than fail the whole signup
    END;
    INSERT INTO programs (hub_id, type, name, age_min_months, age_max_months)
    VALUES (
      v_hub_id, v_prog_type,
      coalesce(nullif(trim(coalesce(v_activity ->> 'name', '')), ''),
               initcap(replace(v_prog_type::text, '_', ' '))),
      nullif(v_activity ->> 'age_min_months', '')::smallint,
      nullif(v_activity ->> 'age_max_months', '')::smallint
    )
    RETURNING id INTO v_prog_id;
    v_prog_map := v_prog_map || jsonb_build_object(v_prog_type::text, v_prog_id);
  END LOOP;

  -- first class (optional) — linked to the chosen activity's program
  IF p_first_class IS NOT NULL AND (p_first_class ? 'program_type') AND (p_first_class ? 'starts_at') THEN
    BEGIN
      v_first_type := (p_first_class ->> 'program_type')::program_type;
    EXCEPTION WHEN others THEN
      v_first_type := NULL;
    END;
    IF v_first_type IS NOT NULL THEN
      v_prog_id := (v_prog_map ->> v_first_type::text)::uuid;
      IF v_prog_id IS NOT NULL THEN
        INSERT INTO class_sessions (hub_id, program_id, starts_at, ends_at, capacity)
        VALUES (
          v_hub_id, v_prog_id,
          (p_first_class ->> 'starts_at')::timestamptz,
          nullif(p_first_class ->> 'ends_at', '')::timestamptz,
          nullif(p_first_class ->> 'capacity', '')::smallint
        );
      END IF;
    END IF;
  END IF;

  RETURN jsonb_build_object('ok', true, 'hub_id', v_hub_id, 'slug', v_slug);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.provision_hub(text, text, text, text, jsonb, jsonb) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.provision_hub(text, text, text, text, jsonb, jsonb) TO authenticated;

-- ════════════════════════════════════════════════════════════
-- 3. hub_invites — owner emails a staff member a scoped join token
--    Only a SHA-256 hash of the token is stored (same discipline as guardian
--    links). The raw token lives only in the shareable /accept-invite link.
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS hub_invites (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hub_id      uuid NOT NULL REFERENCES hubs(id) ON DELETE CASCADE,
  email       text NOT NULL,
  role        hub_role NOT NULL DEFAULT 'staff',   -- staff-scoped ONLY (never owner)
  token_hash  text NOT NULL UNIQUE,
  invited_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  accepted_at timestamptz,
  accepted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  expires_at  timestamptz NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_hub_invites_hub ON hub_invites (hub_id, created_at DESC);
-- One open (unaccepted) invite per email per hub; re-inviting refreshes it (RPC deletes the old).
CREATE UNIQUE INDEX IF NOT EXISTS idx_hub_invites_open ON hub_invites (hub_id, lower(email)) WHERE accepted_at IS NULL;
ALTER TABLE hub_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE hub_invites FORCE  ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON hub_invites TO authenticated;

-- Owners manage their hub's invites; staff and other hubs see nothing. Invitees
-- never read this table directly — they go through the SECURITY DEFINER RPCs.
DROP POLICY IF EXISTS hub_invites_owner_all ON hub_invites;
CREATE POLICY hub_invites_owner_all ON hub_invites
  FOR ALL TO authenticated
  USING (hub_id IN (SELECT auth_owned_hub_ids()))
  WITH CHECK (hub_id IN (SELECT auth_owned_hub_ids()));

-- ─── create_hub_invite — owner mints a staff invite token ───────────────
CREATE OR REPLACE FUNCTION public.create_hub_invite(
  p_hub_id uuid,
  p_email  text,
  p_role   hub_role DEFAULT 'staff'
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  v_uid     uuid := auth.uid();
  v_email   text := lower(trim(coalesce(p_email, '')));
  v_token   text;
  v_hash    text;
  v_id      uuid;
  v_expires timestamptz;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated');
  END IF;
  -- Caller must OWN the hub (not merely be a member) to invite staff.
  IF NOT EXISTS (SELECT 1 FROM hub_members WHERE user_id = v_uid AND hub_id = p_hub_id AND role = 'owner') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;
  IF v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_email');
  END IF;

  -- Invites via this path are ALWAYS staff-scoped (T-005 RLS enforces the rest).
  p_role := 'staff';

  -- Refresh any prior open invite for this email so the owner always shares a live link.
  DELETE FROM hub_invites WHERE hub_id = p_hub_id AND lower(email) = v_email AND accepted_at IS NULL;

  v_token   := replace(replace(replace(encode(gen_random_bytes(32), 'base64'), '+', '-'), '/', '_'), '=', '');
  v_hash    := encode(digest(v_token, 'sha256'), 'hex');
  v_expires := now() + interval '14 days';

  INSERT INTO hub_invites (hub_id, email, role, token_hash, invited_by, expires_at)
  VALUES (p_hub_id, v_email, p_role, v_hash, v_uid, v_expires)
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('ok', true, 'invite_id', v_id, 'token', v_token,
                            'email', v_email, 'role', p_role, 'expires_at', v_expires);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.create_hub_invite(uuid, text, hub_role) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.create_hub_invite(uuid, text, hub_role) TO authenticated;

-- ─── resolve_hub_invite — landing page shows who invited you (pre sign-in) ─
CREATE OR REPLACE FUNCTION public.resolve_hub_invite(p_token text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  v_inv      hub_invites%ROWTYPE;
  v_hash     text;
  v_hub_name text;
BEGIN
  IF p_token IS NULL OR length(p_token) < 20 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid');
  END IF;
  v_hash := encode(digest(p_token, 'sha256'), 'hex');
  SELECT * INTO v_inv FROM hub_invites WHERE token_hash = v_hash;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid');   -- unknown == invalid (no enumeration)
  END IF;
  IF v_inv.accepted_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'accepted');
  END IF;
  IF v_inv.expires_at <= now() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'expired');
  END IF;
  SELECT name INTO v_hub_name FROM hubs WHERE id = v_inv.hub_id;
  RETURN jsonb_build_object('ok', true,
                            'hub', jsonb_build_object('id', v_inv.hub_id, 'name', v_hub_name),
                            'role', v_inv.role, 'email', v_inv.email);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.resolve_hub_invite(text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.resolve_hub_invite(text) TO anon, authenticated;

-- ─── accept_hub_invite — invitee (signed in) claims staff access ─────────
CREATE OR REPLACE FUNCTION public.accept_hub_invite(p_token text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  v_inv      hub_invites%ROWTYPE;
  v_hash     text;
  v_uid      uuid := auth.uid();
  v_email    text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_hub_name text;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated');
  END IF;
  IF p_token IS NULL OR length(p_token) < 20 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid');
  END IF;
  v_hash := encode(digest(p_token, 'sha256'), 'hex');
  SELECT * INTO v_inv FROM hub_invites WHERE token_hash = v_hash FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid');
  END IF;

  SELECT name INTO v_hub_name FROM hubs WHERE id = v_inv.hub_id;

  IF v_inv.accepted_at IS NOT NULL THEN
    -- Idempotent: same user re-opening the link after joining is a success, not an error.
    IF v_inv.accepted_by = v_uid THEN
      RETURN jsonb_build_object('ok', true, 'already', true,
                                'hub', jsonb_build_object('id', v_inv.hub_id, 'name', v_hub_name),
                                'role', v_inv.role);
    END IF;
    RETURN jsonb_build_object('ok', false, 'reason', 'accepted');
  END IF;
  IF v_inv.expires_at <= now() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'expired');
  END IF;
  -- The signed-in account's email MUST match the invited email (no invite hijack).
  IF lower(v_inv.email) <> v_email THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'email_mismatch', 'expected', v_inv.email);
  END IF;

  INSERT INTO hub_members (hub_id, user_id, role)
  VALUES (v_inv.hub_id, v_uid, v_inv.role)
  ON CONFLICT (hub_id, user_id) DO NOTHING;

  UPDATE hub_invites SET accepted_at = now(), accepted_by = v_uid WHERE id = v_inv.id;

  RETURN jsonb_build_object('ok', true,
                            'hub', jsonb_build_object('id', v_inv.hub_id, 'name', v_hub_name),
                            'role', v_inv.role);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.accept_hub_invite(text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.accept_hub_invite(text) TO authenticated;
