-- ============================================================
-- Amityx — Demo seed (T-005)
-- Idempotent: deterministic UUIDs + ON CONFLICT DO NOTHING, so re-running (or
-- running after `supabase db reset`) never duplicates rows. Fictional data only.
--
-- Creates ONE demo hub with multi-activity programs + upcoming sessions, plus a
-- demo child + guardian + child↔guardian link so the guardian-link RPC and the
-- roster surfaces have something to render. Hub members (owner/staff) are NOT
-- seeded here because they reference auth.users — create those via Supabase Auth
-- (the adversarial RLS test script provisions its own throwaway auth users).
--
-- Run: `supabase db reset` (applies migrations then this file), or paste into
-- the Supabase Dashboard → SQL Editor after the migrations.
-- ============================================================

DO $$
DECLARE
  hub_id      uuid := '00000000-0000-4000-a000-000000000001';
  p_art       uuid := '00000000-0000-4000-a000-0000000000a1';
  p_swim      uuid := '00000000-0000-4000-a000-0000000000a2';
  p_karate    uuid := '00000000-0000-4000-a000-0000000000a3';
  p_openplay  uuid := '00000000-0000-4000-a000-0000000000a4';
  p_camp      uuid := '00000000-0000-4000-a000-0000000000a5';
  child_id    uuid := '00000000-0000-4000-a000-0000000000c1';
  guardian_id uuid := '00000000-0000-4000-a000-0000000000d1';
  today       date := CURRENT_DATE;
BEGIN
  -- ─── Hub ───────────────────────────────────────────────────
  INSERT INTO hubs (id, name, slug, public_booking_enabled, timezone, city, state, plan)
  VALUES (hub_id, 'Sunbeam Play Studio', 'sunbeam-demo', true,
          'America/Los_Angeles', 'Temecula', 'CA', 'free')
  ON CONFLICT (id) DO NOTHING;

  -- ─── Programs (multi-activity) ─────────────────────────────
  INSERT INTO programs (id, hub_id, type, name, description, age_min_months, age_max_months, capacity) VALUES
    (p_art,      hub_id, 'art',       'Tiny Artists',      'Sensory art & craft for toddlers',        18, 60, 12),
    (p_swim,     hub_id, 'swim',      'Splash Starters',   'Parent-and-me water confidence',           6, 48,  8),
    (p_karate,   hub_id, 'karate',    'Little Dragons',    'Beginner movement & focus',               36, 72, 14),
    (p_openplay, hub_id, 'open_play', 'Open Play',         'Drop-in free play in the big room',         0, 60, 30),
    (p_camp,     hub_id, 'camp',      'Summer Mini Camp',  'Half-day themed camp weeks',               36, 84, 20)
  ON CONFLICT (id) DO NOTHING;

  -- ─── Sessions (upcoming instances across programs) ─────────
  INSERT INTO class_sessions (id, hub_id, program_id, starts_at, ends_at, capacity, location) VALUES
    ('00000000-0000-4000-a000-0000000000b1', hub_id, p_art,      (today + 1) + time '09:30', (today + 1) + time '10:15', 12, 'Studio A'),
    ('00000000-0000-4000-a000-0000000000b2', hub_id, p_art,      (today + 3) + time '09:30', (today + 3) + time '10:15', 12, 'Studio A'),
    ('00000000-0000-4000-a000-0000000000b3', hub_id, p_swim,     (today + 1) + time '11:00', (today + 1) + time '11:40',  8, 'Pool'),
    ('00000000-0000-4000-a000-0000000000b4', hub_id, p_karate,   (today + 2) + time '16:00', (today + 2) + time '16:45', 14, 'Mat Room'),
    ('00000000-0000-4000-a000-0000000000b5', hub_id, p_openplay, (today)     + time '13:00', (today)     + time '16:00', 30, 'Big Room'),
    ('00000000-0000-4000-a000-0000000000b6', hub_id, p_camp,     (today + 7) + time '09:00', (today + 7) + time '12:00', 20, 'Studio B')
  ON CONFLICT (id) DO NOTHING;

  -- ─── Demo child + guardian + link (photo_consent ON) ───────
  INSERT INTO children (id, hub_id, display_name, birthdate, photo_consent)
  VALUES (child_id, hub_id, 'Mia R.', today - INTERVAL '3 years', true)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO guardians (id, hub_id, display_name, email, phone)
  VALUES (guardian_id, hub_id, 'Dana R.', 'dana.demo@example.com', '555-0100')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO child_guardians (hub_id, child_id, guardian_id, relationship, is_primary)
  VALUES (hub_id, child_id, guardian_id, 'parent', true)
  ON CONFLICT (child_id, guardian_id) DO NOTHING;

  INSERT INTO enrollments (hub_id, child_id, program_id, status)
  VALUES (hub_id, child_id, p_art, 'active')
  ON CONFLICT DO NOTHING;
END $$;
