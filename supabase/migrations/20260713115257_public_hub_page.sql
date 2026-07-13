-- ============================================================
-- Amityx — Public hub page RPC (T-010)
--
-- T-005's RLS deliberately keeps `programs_read` / `class_sessions_read` /
-- `hubs_read` authenticated-only — anon has NO table-level read access to hubs,
-- programs, or class_sessions. The public booking page (/h/{slug}) still needs
-- an anonymous visitor to see a hub's public profile + active activities +
-- upcoming classes + live capacity/waitlist counts. Rather than loosen RLS with
-- a blanket anon SELECT (which would leak billing/plan/settings/internal notes),
-- this mirrors the SAME curated-read pattern already used for the guardian-link
-- path (guardian_link_rpcs migration, resolve_guardian_link): a SECURITY DEFINER
-- RPC that returns ONLY an explicit, public-safe field allowlist.
--
--   get_public_hub_page(slug) → anon + authenticated.
--       Unknown slug OR a hub with public_booking_enabled = false both return
--       the SAME { ok: false, reason: 'not_found' } shape (no enumeration signal,
--       same principle as resolve_guardian_link's invalid-token handling) — a
--       disabled public page reads identically to a hub that doesn't exist.
--       Exposes: hub name/slug/city/state/address/timezone (never plan,
--       stripe_customer_id, settings, created_by); each ACTIVE program's
--       name/description/type/age band/capacity + live active-enrollment count
--       (never guardian/child names — just aggregate counts, same "counts not
--       rows" discipline as `announcements.read_count`, R-003); each active
--       upcoming (starts_at >= now()) class_sessions row's schedule/capacity +
--       live active-enrollment count.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_public_hub_page(p_slug text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_hub      hubs%ROWTYPE;
  v_programs jsonb;
BEGIN
  IF p_slug IS NULL OR length(trim(p_slug)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  SELECT * INTO v_hub FROM hubs WHERE slug = lower(trim(p_slug));

  -- Unknown slug and a hub that turned its public page off report identically —
  -- no signal to distinguish "never existed" from "exists but not accepting
  -- requests right now" (mirrors resolve_guardian_link's no-enumeration rule).
  IF NOT FOUND OR v_hub.public_booking_enabled IS NOT TRUE THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id',             p.id,
        'type',           p.type,
        'name',           p.name,
        'description',    p.description,
        'age_min_months', p.age_min_months,
        'age_max_months', p.age_max_months,
        'capacity',       p.capacity,
        -- Program-level active enrollments: only rows enrolled directly against
        -- the program (no specific session) hold a program-level seat — mirrors
        -- ApiRepository.countActiveEnrollments' session_id IS NULL branch.
        'active_count', (
          SELECT count(*) FROM enrollments e
           WHERE e.program_id = p.id AND e.session_id IS NULL AND e.status = 'active'
        ),
        'sessions', (
          SELECT coalesce(
            jsonb_agg(
              jsonb_build_object(
                'id',        s.id,
                'starts_at', s.starts_at,
                'ends_at',   s.ends_at,
                'capacity',  s.capacity,
                'location',  s.location,
                'active_count', (
                  SELECT count(*) FROM enrollments e2
                   WHERE e2.session_id = s.id AND e2.status = 'active'
                )
              ) ORDER BY s.starts_at
            ),
            '[]'::jsonb
          )
          FROM class_sessions s
          WHERE s.program_id = p.id AND s.active = true AND s.starts_at >= now()
        )
      ) ORDER BY p.created_at
    ),
    '[]'::jsonb
  )
  INTO v_programs
  FROM programs p
  WHERE p.hub_id = v_hub.id AND p.active = true;

  RETURN jsonb_build_object(
    'ok', true,
    'hub', jsonb_build_object(
      'id',       v_hub.id,
      'name',     v_hub.name,
      'slug',     v_hub.slug,
      'city',     v_hub.city,
      'state',    v_hub.state,
      'address',  v_hub.address,
      'timezone', v_hub.timezone
      -- deliberately NOT included: plan, stripe_customer_id, settings, created_by,
      -- created_at, public_booking_enabled — internal/billing fields stay server-side.
    ),
    'programs', v_programs
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_public_hub_page(text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_public_hub_page(text) TO anon, authenticated;
