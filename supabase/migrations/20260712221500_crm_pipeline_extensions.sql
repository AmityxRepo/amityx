-- ============================================================
-- Amityx — CRM pipeline extensions for the internal /crm surface (T-008)
--
-- T-005's crm_onboarding_stage enum and crm_hub_profiles table did not yet
-- carry what T-008's own spec requires, so this migration adds exactly that
-- (additive only — nothing here changes T-005/T-006 behavior):
--
--   1. crm_onboarding_stage gets a 'prospect' value BEFORE 'signup' — the CRM
--      seed (docs/PILOT_TARGETS.md "The 10 slots") tracks outreach-stage
--      businesses that have no account yet, which the existing stages
--      (signup..churned) don't represent.
--   2. crm_hub_profiles gets archived/archived_at — the spec's "hubs list:
--      search/filter/archive toggle" and "archive w/ confirmation (reversible)"
--      need a place to persist that state. Already covered by the existing
--      `crm_hub_profiles_all` RLS policy (is_crm_admin()) — no policy change.
--   3. Two new SECURITY DEFINER RPCs for the CRM's "Create hub + invite owner"
--      provisioning action:
--        - crm_provision_hub  — crm_admin-only variant of T-006's provision_hub.
--          It reuses the identical hub/programs/crm_hub_profiles insert shape,
--          so a CRM-created hub is DATA-IDENTICAL to a self-signup hub. It
--          deliberately does NOT insert a hub_members row for the calling
--          admin (unlike provision_hub, which binds hub_members to the
--          caller) — ARCHITECTURE.md's "platform_admin ... never inside hub
--          data by default" rule means the admin must never become a member
--          of a hub they set up on someone else's behalf.
--        - crm_invite_hub_owner — mints an OWNER-scoped hub_invites row (the
--          existing create_hub_invite RPC only ever mints STAFF invites, by
--          design, for an owner inviting their own staff — a different case).
--          Guarded to hubs with zero hub_members so this can never displace a
--          real owner. accept_hub_invite (T-006, unchanged) already assigns
--          whatever role the invite carries, so no changes needed there.
--
-- Idempotent: ADD VALUE IF NOT EXISTS / ADD COLUMN IF NOT EXISTS / CREATE OR
-- REPLACE for functions. Greenfield DB (same as every prior migration here).
-- ============================================================

-- ─── 1. crm_onboarding_stage: add 'prospect' ─────────────────
-- Must be a standalone statement (PG rule: a just-added enum value cannot be
-- used in the same transaction/migration that adds it) — nothing below
-- references 'prospect' as a literal, only the seed script (a separate
-- connection, run after this migration is applied) does.
ALTER TYPE crm_onboarding_stage ADD VALUE IF NOT EXISTS 'prospect' BEFORE 'signup';

-- ─── 2. crm_hub_profiles: archive (reversible) ───────────────
ALTER TABLE crm_hub_profiles ADD COLUMN IF NOT EXISTS archived    boolean NOT NULL DEFAULT false;
ALTER TABLE crm_hub_profiles ADD COLUMN IF NOT EXISTS archived_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_crm_hub_profiles_archived ON crm_hub_profiles (archived);

-- ─── 3a. crm_provision_hub — crm_admin creates a hub, no membership granted ──
CREATE OR REPLACE FUNCTION public.crm_provision_hub(
  p_name        text,
  p_slug        text,
  p_timezone    text         DEFAULT 'America/Los_Angeles',
  p_owner_name  text         DEFAULT NULL,
  p_owner_email text         DEFAULT NULL,
  p_priority    crm_priority DEFAULT 'normal',
  p_activities  jsonb        DEFAULT '[]'::jsonb,
  p_first_class jsonb        DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid        uuid := auth.uid();
  v_name       text := trim(coalesce(p_name, ''));
  v_slug       text := lower(trim(coalesce(p_slug, '')));
  v_hub_id     uuid;
  v_activity   jsonb;
  v_prog_type  program_type;
  v_prog_id    uuid;
  v_first_type program_type;
  v_prog_map   jsonb := '{}'::jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated');
  END IF;
  IF NOT public.is_crm_admin() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
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

  -- hub (tenant root) — created_by records the admin for audit only.
  INSERT INTO hubs (name, slug, timezone, created_by)
  VALUES (v_name, v_slug, coalesce(nullif(trim(coalesce(p_timezone, '')), ''), 'America/Los_Angeles'), v_uid)
  RETURNING id INTO v_hub_id;

  -- CRM pipeline row — 'prospect' (not 'signup': nobody has an account yet).
  INSERT INTO crm_hub_profiles (hub_id, subscription_status, onboarding_stage, priority, owner_name, owner_email)
  VALUES (v_hub_id, 'free', 'prospect', coalesce(p_priority, 'normal'),
          nullif(trim(coalesce(p_owner_name, '')), ''),
          nullif(lower(trim(coalesce(p_owner_email, ''))), ''));

  -- activities (programs) — same template-picker shape as provision_hub.
  FOR v_activity IN SELECT * FROM jsonb_array_elements(coalesce(p_activities, '[]'::jsonb))
  LOOP
    BEGIN
      v_prog_type := (v_activity ->> 'type')::program_type;
    EXCEPTION WHEN others THEN
      CONTINUE;
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
REVOKE EXECUTE ON FUNCTION public.crm_provision_hub(text, text, text, text, text, crm_priority, jsonb, jsonb) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.crm_provision_hub(text, text, text, text, text, crm_priority, jsonb, jsonb) TO authenticated;

-- ─── 3b. crm_invite_hub_owner — mint an OWNER-role invite (fresh hub only) ───
CREATE OR REPLACE FUNCTION public.crm_invite_hub_owner(
  p_hub_id uuid,
  p_email  text
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
  IF NOT public.is_crm_admin() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM hubs WHERE id = p_hub_id) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'hub_not_found');
  END IF;
  -- Never displace a real owner: only a hub with zero members yet (freshly
  -- crm_provision_hub'd) can receive an owner invite through this path. A hub
  -- that already has an owner uses that owner's own create_hub_invite instead.
  IF EXISTS (SELECT 1 FROM hub_members WHERE hub_id = p_hub_id AND role = 'owner') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_owned');
  END IF;
  IF v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_email');
  END IF;

  -- Refresh any prior open invite for this email so re-inviting shares a live link.
  DELETE FROM hub_invites WHERE hub_id = p_hub_id AND lower(email) = v_email AND accepted_at IS NULL;

  v_token   := replace(replace(replace(encode(gen_random_bytes(32), 'base64'), '+', '-'), '/', '_'), '=', '');
  v_hash    := encode(digest(v_token, 'sha256'), 'hex');
  v_expires := now() + interval '14 days';

  INSERT INTO hub_invites (hub_id, email, role, token_hash, invited_by, expires_at)
  VALUES (p_hub_id, v_email, 'owner', v_hash, v_uid, v_expires)
  RETURNING id INTO v_id;

  -- Keep the pipeline's owner_email in sync with who was actually invited.
  UPDATE crm_hub_profiles SET owner_email = v_email WHERE hub_id = p_hub_id;

  RETURN jsonb_build_object('ok', true, 'invite_id', v_id, 'token', v_token,
                            'email', v_email, 'role', 'owner', 'expires_at', v_expires);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.crm_invite_hub_owner(uuid, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.crm_invite_hub_owner(uuid, text) TO authenticated;
