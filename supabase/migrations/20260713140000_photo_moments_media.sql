-- ============================================================
-- Amityx — Parent layer: photo moments, consent, media (T-011)
--
-- Extends the T-005 schema (photo_moments / announcements / guardian_links /
-- children.photo_consent all already exist) with everything the no-install
-- parent layer needs, keeping the SAME security discipline used all cycle:
-- deny-by-default RLS + SECURITY DEFINER RPCs as the ONLY parent read path.
--
-- What this migration adds:
--   1. photo_moment_children — multi-child tagging for group photos (the missing
--      piece: photo_moments.child_id is a single nullable FK, so "which children
--      are in this group photo" had nowhere to live). RLS mirrors photo_moments.
--   2. announcements.image_path — optional hub-wide broadcast image (general
--      updates; child close-ups go through the consent-enforced photo path).
--   3. photo_moments.expires_at default trigger — the 30-day free window (D-009).
--   4. create_photo_moment(...) — WRITE-time consent gate. Every photo MUST tag
--      >=1 child and EVERY tagged child must have photo_consent, else the write is
--      REJECTED naming the blocking child. This makes the read-time invariant
--      trivially true: a distributed photo has ZERO non-consented subjects, so
--      no runtime filtering can ever leak one (chosen over "store-but-hide").
--   5. get_guardian_feed(token) — the parent read path (anon, SECURITY DEFINER).
--      Returns ONLY the guardian's CONSENTED children + their upcoming schedule +
--      hub announcements + their photo-moment storage_paths (never signed here —
--      Postgres can't sign; the guardian-media Edge Function signs, see below).
--      A no-consent child is invisible on EVERY surface (D-009 "gates parent-
--      portal visibility"), same gate resolve_guardian_link already applies.
--   6. mark_guardian_announcements_read(token, ids) — aggregate view counts only
--      (increments announcements.read_count; NO per-recipient rows — R-003).
--   7. Private 'photo-moments' Storage bucket + storage.objects RLS: staff (hub
--      members) upload/read/delete their OWN hub's folder; anon gets NOTHING on
--      storage (guardians receive short-lived signed URLs via the Edge Function,
--      which re-derives the allowed path set from the token — capability, not a
--      public bucket). Object keys are random UUIDs under {hub_id}/ so a path is
--      never guessable from a child name/slug.
--
-- Idempotent: CREATE ... IF NOT EXISTS / CREATE OR REPLACE / DROP POLICY IF
-- EXISTS / ON CONFLICT DO NOTHING. Safe to re-run.
-- ============================================================

-- ─── 1. photo_moment_children (multi-child tagging join) ─────
CREATE TABLE IF NOT EXISTS photo_moment_children (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hub_id     uuid NOT NULL REFERENCES hubs(id) ON DELETE CASCADE,
  photo_id   uuid NOT NULL REFERENCES photo_moments(id) ON DELETE CASCADE,
  child_id   uuid NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (photo_id, child_id)
);
CREATE INDEX IF NOT EXISTS idx_pmc_photo ON photo_moment_children (photo_id);
CREATE INDEX IF NOT EXISTS idx_pmc_child ON photo_moment_children (child_id);
CREATE INDEX IF NOT EXISTS idx_pmc_hub   ON photo_moment_children (hub_id);
ALTER TABLE photo_moment_children ENABLE ROW LEVEL SECURITY;
ALTER TABLE photo_moment_children FORCE  ROW LEVEL SECURITY;

-- Grants: a NEW table is NOT covered by T-005's one-time GRANT ... ON ALL TABLES,
-- so grant explicitly. anon gets nothing (parents never touch tables — RPC only).
GRANT SELECT, INSERT, UPDATE, DELETE ON photo_moment_children TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON photo_moment_children TO service_role;

-- RLS mirrors photo_moments: read = members+support, write = members. (Real writes
-- go through create_photo_moment, a SECURITY DEFINER RPC; this policy is the
-- deny-by-default backstop so the table is never reachable cross-tenant.)
DROP POLICY IF EXISTS photo_moment_children_read  ON photo_moment_children;
DROP POLICY IF EXISTS photo_moment_children_write ON photo_moment_children;
CREATE POLICY photo_moment_children_read  ON photo_moment_children FOR SELECT TO authenticated
  USING (hub_id IN (SELECT auth_read_hub_ids()));
CREATE POLICY photo_moment_children_write ON photo_moment_children FOR ALL TO authenticated
  USING (hub_id IN (SELECT auth_hub_ids())) WITH CHECK (hub_id IN (SELECT auth_hub_ids()));

-- ─── 2. announcements.image_path (hub-wide broadcast image) ──
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS image_path text;

-- ─── 3. photo_moments 30-day window default (D-009) ──────────
-- The RPC sets expires_at explicitly; this trigger guarantees the window even for
-- a direct insert (seed/backfill), so the purge job always has a boundary to act on.
CREATE OR REPLACE FUNCTION public.fn_photo_moment_expiry()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.expires_at IS NULL THEN
    NEW.expires_at := coalesce(NEW.taken_at, now()) + interval '30 days';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS tg_photo_moment_expiry ON photo_moments;
CREATE TRIGGER tg_photo_moment_expiry
  BEFORE INSERT ON photo_moments
  FOR EACH ROW EXECUTE FUNCTION public.fn_photo_moment_expiry();

-- ════════════════════════════════════════════════════════════
-- 4. create_photo_moment — WRITE-time consent gate
-- ════════════════════════════════════════════════════════════
-- Every photo is tagged with >=1 child; EVERY tagged child must belong to the hub,
-- be active, and have photo_consent = true. If any child fails, the whole write is
-- rejected and the offending child(ren) are named so staff know exactly what to fix.
-- Group-wide GENERAL images (flyers, room shots) are NOT children and go through
-- announcements.image_path instead — never through this per-child path.
CREATE OR REPLACE FUNCTION public.create_photo_moment(
  p_hub_id       uuid,
  p_storage_path text,
  p_child_ids    uuid[],
  p_caption      text        DEFAULT NULL,
  p_session_id   uuid        DEFAULT NULL,
  p_taken_at     timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_taken   timestamptz := coalesce(p_taken_at, now());
  v_expires timestamptz;
  v_moment  uuid;
  v_blocked text;
  v_single  uuid;
  v_count   integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM hub_members WHERE user_id = auth.uid() AND hub_id = p_hub_id) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;

  IF p_storage_path IS NULL OR length(trim(p_storage_path)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_path');
  END IF;
  -- Path must live under THIS hub's folder — matches the storage RLS folder gate
  -- and lets the purge job scope byte-deletes per hub. (Keys are {hub_id}/{uuid}.)
  IF split_part(p_storage_path, '/', 1) <> p_hub_id::text THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_path');
  END IF;

  p_child_ids := coalesce(p_child_ids, '{}');
  SELECT count(*) INTO v_count FROM unnest(p_child_ids) AS t(cid);
  IF v_count = 0 THEN
    -- No untagged/hub-wide photo path: a photo of children must name them so we can
    -- enforce consent. (Hub-wide general images use announcements.image_path.)
    RETURN jsonb_build_object('ok', false, 'reason', 'no_children');
  END IF;

  -- Any tagged child that would BLOCK distribution: not in this hub / inactive, or
  -- consent = false. Name them all so staff can fix or untag.
  SELECT string_agg(label, ', ') INTO v_blocked
  FROM (
    SELECT coalesce(c.display_name, 'an unknown child') AS label
    FROM unnest(p_child_ids) AS t(cid)
    LEFT JOIN children c ON c.id = t.cid AND c.hub_id = p_hub_id AND c.active = true
    WHERE c.id IS NULL OR c.photo_consent = false
  ) blockers;
  IF v_blocked IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'consent_required', 'blocked', v_blocked);
  END IF;

  v_expires := v_taken + interval '30 days';
  IF v_count = 1 THEN v_single := p_child_ids[1]; ELSE v_single := NULL; END IF;  -- NULL = group moment

  INSERT INTO photo_moments (hub_id, child_id, session_id, storage_path, caption, taken_at, expires_at, created_by)
  VALUES (p_hub_id, v_single, p_session_id, p_storage_path,
          nullif(trim(coalesce(p_caption, '')), ''), v_taken, v_expires, auth.uid())
  RETURNING id INTO v_moment;

  INSERT INTO photo_moment_children (hub_id, photo_id, child_id)
  SELECT p_hub_id, v_moment, t.cid FROM unnest(p_child_ids) AS t(cid);

  RETURN jsonb_build_object('ok', true, 'moment_id', v_moment, 'expires_at', v_expires);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_photo_moment(uuid, text, uuid[], text, uuid, timestamptz) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.create_photo_moment(uuid, text, uuid[], text, uuid, timestamptz) TO authenticated;

-- ════════════════════════════════════════════════════════════
-- 5. get_guardian_feed — the parent READ path (anon)
-- ════════════════════════════════════════════════════════════
-- search_path includes `extensions` for pgcrypto digest() (same as the T-005 RPCs).
-- Returns storage_path values but NEVER signed URLs (Postgres cannot sign). The
-- guardian-media Edge Function re-derives the allowed paths from the token and
-- signs them with the service key, so an anon caller can only ever obtain a signed
-- URL for a photo of their OWN consented child.
CREATE OR REPLACE FUNCTION public.get_guardian_feed(p_token text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  v_link          guardian_links%ROWTYPE;
  v_hash          text;
  v_hub_name      text;
  v_child_ids     uuid[];
  v_children      jsonb;
  v_schedule      jsonb;
  v_announcements jsonb;
  v_photos        jsonb;
BEGIN
  IF p_token IS NULL OR length(p_token) < 20 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid');
  END IF;

  v_hash := encode(digest(p_token, 'sha256'), 'hex');
  SELECT * INTO v_link FROM guardian_links WHERE token_hash = v_hash;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'invalid'); END IF;
  IF v_link.revoked_at IS NOT NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'revoked'); END IF;
  IF v_link.expires_at <= now() THEN RETURN jsonb_build_object('ok', false, 'reason', 'expired'); END IF;

  UPDATE guardian_links SET last_used_at = now() WHERE id = v_link.id;
  SELECT name INTO v_hub_name FROM hubs WHERE id = v_link.hub_id;

  -- CONSENTED children only — the single gate every surface below scopes to
  -- (a no-consent child is invisible in the whole parent portal, D-009).
  SELECT coalesce(array_agg(c.id), '{}'),
         coalesce(jsonb_agg(jsonb_build_object(
           'id', c.id, 'display_name', c.display_name, 'birthdate', c.birthdate
         ) ORDER BY c.display_name), '[]')
    INTO v_child_ids, v_children
    FROM children c
    JOIN child_guardians cg ON cg.child_id = c.id
   WHERE cg.guardian_id = v_link.guardian_id
     AND c.hub_id = v_link.hub_id
     AND c.photo_consent = true
     AND c.active = true;

  -- Upcoming classes for those children (active enrollments, future sessions).
  -- A child may be enrolled directly on a session OR program-wide (session_id NULL).
  SELECT coalesce(jsonb_agg(x ORDER BY (x->>'starts_at')), '[]') INTO v_schedule
  FROM (
    SELECT DISTINCT jsonb_build_object(
      'session_id',   s.id,
      'child_id',     c.id,
      'child_name',   c.display_name,
      'program_name', p.name,
      'starts_at',    s.starts_at,
      'ends_at',      s.ends_at,
      'location',     s.location
    ) AS x
    FROM class_sessions s
    JOIN programs p    ON p.id = s.program_id
    JOIN children c    ON c.id = ANY(v_child_ids)
    JOIN enrollments e ON e.child_id = c.id AND e.hub_id = s.hub_id AND e.status = 'active'
                      AND (e.session_id = s.id OR (e.session_id IS NULL AND e.program_id = s.program_id))
    WHERE s.hub_id = v_link.hub_id AND s.active = true AND s.starts_at >= now()
  ) sub;

  -- Hub announcements (published), newest first. image_path is signed by the Edge fn.
  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'id', a.id, 'title', a.title, 'body', a.body,
           'published_at', a.published_at, 'image_path', a.image_path
         ) ORDER BY a.published_at DESC), '[]') INTO v_announcements
    FROM announcements a
   WHERE a.hub_id = v_link.hub_id
     AND a.published_at IS NOT NULL
     AND a.published_at <= now();

  -- Photo moments tagged to this guardian's consented children, within the 30-day
  -- window. DISTINCT ON collapses a group photo tagged to several of the guardian's
  -- children into ONE entry. Every path here has zero non-consented subjects
  -- (guaranteed at write by create_photo_moment).
  SELECT coalesce(jsonb_agg(x ORDER BY (x->>'taken_at') DESC), '[]') INTO v_photos
  FROM (
    SELECT DISTINCT ON (pm.id)
      jsonb_build_object(
        'id',           pm.id,
        'caption',      pm.caption,
        'taken_at',     pm.taken_at,
        'storage_path', pm.storage_path,
        'is_group',     (pm.child_id IS NULL)
      ) AS x
    FROM photo_moments pm
    JOIN photo_moment_children pmc ON pmc.photo_id = pm.id
    WHERE pm.hub_id = v_link.hub_id
      AND pmc.child_id = ANY(v_child_ids)
      AND (pm.expires_at IS NULL OR pm.expires_at > now())
    ORDER BY pm.id
  ) sub;

  RETURN jsonb_build_object(
    'ok',            true,
    'guardian_id',   v_link.guardian_id,
    'hub',           jsonb_build_object('id', v_link.hub_id, 'name', v_hub_name),
    'children',      v_children,
    'schedule',      v_schedule,
    'announcements', v_announcements,
    'photos',        v_photos
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_guardian_feed(text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_guardian_feed(text) TO anon, authenticated;

-- ════════════════════════════════════════════════════════════
-- 6. mark_guardian_announcements_read — aggregate counts ONLY
-- ════════════════════════════════════════════════════════════
-- Increments announcements.read_count for the given (validated, hub-scoped)
-- announcement ids. NO per-recipient receipt row is ever written (R-003).
CREATE OR REPLACE FUNCTION public.mark_guardian_announcements_read(p_token text, p_ids uuid[])
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  v_link guardian_links%ROWTYPE;
  v_hash text;
  v_n    integer;
BEGIN
  IF p_token IS NULL OR length(p_token) < 20 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid');
  END IF;
  v_hash := encode(digest(p_token, 'sha256'), 'hex');
  SELECT * INTO v_link FROM guardian_links WHERE token_hash = v_hash;
  IF NOT FOUND OR v_link.revoked_at IS NOT NULL OR v_link.expires_at <= now() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid');
  END IF;

  UPDATE announcements
     SET read_count = read_count + 1
   WHERE hub_id = v_link.hub_id
     AND id = ANY(coalesce(p_ids, '{}'))
     AND published_at IS NOT NULL;
  GET DIAGNOSTICS v_n = ROW_COUNT;

  RETURN jsonb_build_object('ok', true, 'counted', v_n);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.mark_guardian_announcements_read(text, uuid[]) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.mark_guardian_announcements_read(text, uuid[]) TO anon, authenticated;

-- ════════════════════════════════════════════════════════════
-- 7. Private Storage bucket + storage.objects RLS
-- ════════════════════════════════════════════════════════════
-- PRIVATE bucket (public = false): no anonymous LIST, no public read. Toddler media
-- is NEVER served except through a short-lived signed URL. A 5 MB per-object cap +
-- image mime allowlist blunt abuse (client compresses to ~200 KB webp first).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('photo-moments', 'photo-moments', false, 5242880,
        ARRAY['image/webp', 'image/jpeg', 'image/png'])
ON CONFLICT (id) DO UPDATE
  SET public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- storage.objects RLS: object keys are {hub_id}/{uuid}.webp, so foldername[1] is the
-- owning hub id. Staff (hub members) may write/read/delete ONLY their own hub's
-- folder. anon gets NO storage policy at all — guardians never touch storage
-- directly; the guardian-media Edge Function signs on their behalf.
DROP POLICY IF EXISTS photo_moments_obj_insert ON storage.objects;
DROP POLICY IF EXISTS photo_moments_obj_select ON storage.objects;
DROP POLICY IF EXISTS photo_moments_obj_delete ON storage.objects;

CREATE POLICY photo_moments_obj_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'photo-moments'
    AND (storage.foldername(name))[1]::uuid IN (SELECT auth_hub_ids())
  );

CREATE POLICY photo_moments_obj_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'photo-moments'
    AND (storage.foldername(name))[1]::uuid IN (SELECT auth_read_hub_ids())
  );

CREATE POLICY photo_moments_obj_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'photo-moments'
    AND (storage.foldername(name))[1]::uuid IN (SELECT auth_hub_ids())
  );
