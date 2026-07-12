-- ============================================================
-- Amityx — Guardian-link RPCs (T-005)
--
-- The guardian_links token is the ONLY parent read path. Both functions are
-- SECURITY DEFINER (run as owner, bypass RLS) with a pinned search_path.
--
--   issue_guardian_link(guardian_id, ttl_days)  → authenticated hub members only.
--       Generates a URL-safe random token, stores ONLY its SHA-256 hash, and
--       returns the raw token ONCE (the caller emails the link — D-014). The raw
--       token is never persisted, so a DB read can never reconstruct a live link.
--
--   resolve_guardian_link(token)                → anon (parent has no session).
--       Verifies the token hash, rejects revoked/expired links cleanly (no
--       enumeration: unknown == invalid), scopes to that guardian's children in
--       the linked hub, and DROPS any child without photo_consent (D-009).
-- ============================================================

-- ─── issue_guardian_link ─────────────────────────────────────
-- search_path includes `extensions` because Supabase installs pgcrypto
-- (gen_random_bytes / digest) into the extensions schema, not public.
CREATE OR REPLACE FUNCTION public.issue_guardian_link(
  p_guardian_id uuid,
  p_ttl_days    integer DEFAULT 30
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  v_guardian guardians%ROWTYPE;
  v_token    text;
  v_hash     text;
  v_link_id  uuid;
  v_expires  timestamptz;
  v_ttl      integer := p_ttl_days;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated');
  END IF;

  SELECT * INTO v_guardian FROM guardians WHERE id = p_guardian_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'guardian_not_found');
  END IF;

  -- Caller must be a member of the guardian's hub.
  IF NOT EXISTS (
        SELECT 1 FROM hub_members
         WHERE user_id = auth.uid() AND hub_id = v_guardian.hub_id) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;

  IF v_ttl IS NULL OR v_ttl < 1 OR v_ttl > 365 THEN
    v_ttl := 30;
  END IF;

  -- 32 random bytes → URL-safe base64 token. Returned once, never stored raw.
  v_token := replace(replace(replace(
               encode(gen_random_bytes(32), 'base64'),
               '+', '-'), '/', '_'), '=', '');
  v_hash    := encode(digest(v_token, 'sha256'), 'hex');
  v_expires := now() + make_interval(days => v_ttl);

  INSERT INTO guardian_links (hub_id, guardian_id, token_hash, expires_at, created_by)
  VALUES (v_guardian.hub_id, p_guardian_id, v_hash, v_expires, auth.uid())
  RETURNING id INTO v_link_id;

  RETURN jsonb_build_object(
    'ok',          true,
    'link_id',     v_link_id,
    'token',       v_token,        -- raw token: email it; it is never persisted
    'expires_at',  v_expires,
    'hub_id',      v_guardian.hub_id,
    'guardian_id', p_guardian_id
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.issue_guardian_link(uuid, integer) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.issue_guardian_link(uuid, integer) TO authenticated;

-- ─── resolve_guardian_link ───────────────────────────────────
-- search_path includes `extensions` for pgcrypto's digest() (see issue_guardian_link).
CREATE OR REPLACE FUNCTION public.resolve_guardian_link(p_token text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  v_link     guardian_links%ROWTYPE;
  v_hash     text;
  v_children jsonb;
  v_hub_name text;
BEGIN
  IF p_token IS NULL OR length(p_token) < 20 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid');
  END IF;

  v_hash := encode(digest(p_token, 'sha256'), 'hex');

  SELECT * INTO v_link FROM guardian_links WHERE token_hash = v_hash;
  IF NOT FOUND THEN
    -- Unknown token is reported identically to any other invalid state to
    -- prevent token/enumeration side-channels.
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid');
  END IF;

  IF v_link.revoked_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'revoked');
  END IF;

  IF v_link.expires_at <= now() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'expired');
  END IF;

  UPDATE guardian_links SET last_used_at = now() WHERE id = v_link.id;

  SELECT name INTO v_hub_name FROM hubs WHERE id = v_link.hub_id;

  SELECT coalesce(
           jsonb_agg(
             jsonb_build_object(
               'id',           c.id,
               'display_name',  c.display_name,
               'birthdate',     c.birthdate
             ) ORDER BY c.display_name
           ),
           '[]'::jsonb
         )
    INTO v_children
    FROM children c
    JOIN child_guardians cg ON cg.child_id = c.id
   WHERE cg.guardian_id = v_link.guardian_id
     AND c.hub_id       = v_link.hub_id
     AND c.photo_consent = true    -- exclude no-consent children (D-009)
     AND c.active         = true;

  RETURN jsonb_build_object(
    'ok',          true,
    'guardian_id', v_link.guardian_id,
    'hub',         jsonb_build_object('id', v_link.hub_id, 'name', v_hub_name),
    'children',    v_children
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.resolve_guardian_link(text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.resolve_guardian_link(text) TO anon, authenticated;
