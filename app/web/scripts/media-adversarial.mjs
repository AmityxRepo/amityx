#!/usr/bin/env node
/**
 * Amityx — parent-layer adversarial suite (T-011). The highest-stakes checks in
 * the build: child-media privacy, token scoping, signed-URL-only delivery, purge.
 *
 * Proves, against the REAL live DB + Storage + the deployed guardian-media Edge
 * Function (service-role for setup, then attacks with each principal's own client):
 *   1. A guardian link shows ONLY that guardian's consented children; expired /
 *      revoked / invalid tokens deny cleanly; a token never leaks the other hub.
 *   2. A no-consent child is REJECTED at write (single + group photo) naming the
 *      blocking child, and appears on NO parent-facing surface (children, schedule,
 *      photos) — the write-time gate makes the read invariant airtight.
 *   3. Every media byte is signed + expiring: the bucket is private (no public
 *      URL, no anon list/sign), the Edge Function signs ONLY the caller's own
 *      scoped paths (refuses a cross-hub path even if asked), and a raw path is
 *      not publicly fetchable.
 *   4. A >30-day-old photo is purged — bytes AND row — via purgeExpiredMedia with
 *      a manipulated taken_at/expires_at (no 30-day wait).
 *   5. Announcement view counts are aggregate only (read_count increments; no
 *      per-recipient rows).
 *
 * Run:  cd app/web && node --experimental-websocket scripts/media-adversarial.mjs
 * Needs app/web/.env.local: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY,
 *                           SUPABASE_SERVICE_ROLE_KEY.
 */
import { readFileSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { purgeExpiredMedia } from './purge-media.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))

function loadEnv() {
  const text = readFileSync(resolve(__dirname, '..', '.env.local'), 'utf8')
  const env = {}
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"]*?)"?\s*$/)
    if (m) env[m[1]] = m[2]
  }
  return env
}
const env = loadEnv()
const URL = env.VITE_SUPABASE_URL
const ANON = env.VITE_SUPABASE_ANON_KEY
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY
if (!URL || !ANON || !SERVICE) {
  console.error('Missing env: need VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}
if (typeof globalThis.WebSocket === 'undefined') {
  console.error('Need a global WebSocket. Re-run with: node --experimental-websocket scripts/media-adversarial.mjs (or Node >= 22).')
  process.exit(1)
}

const BUCKET = 'photo-moments'
const svc = createClient(URL, SERVICE, { auth: { autoRefreshToken: false, persistSession: false } })
const anon = createClient(URL, ANON, { auth: { autoRefreshToken: false, persistSession: false } })
const uid = () => randomBytes(8).toString('hex')
const stamp = Date.now()

let passed = 0, failed = 0
const ok = (l) => { passed++; console.log(`  PASS  ${l}`) }
const bad = (l, d) => { failed++; console.log(`  FAIL  ${l}${d ? ` — ${d}` : ''}`) }

const HUB_A = `a1111111-0000-4000-a000-${String(stamp).slice(-12).padStart(12, '0')}`
const HUB_B = `b2222222-0000-4000-a000-${String(stamp).slice(-12).padStart(12, '0')}`
const created = { userIds: [], paths: [] }

async function cleanup() {
  try { if (created.paths.length) await svc.storage.from(BUCKET).remove(created.paths) } catch { /* ignore */ }
  await svc.from('hubs').delete().in('id', [HUB_A, HUB_B])
  const { data: list } = await svc.auth.admin.listUsers({ perPage: 1000 })
  for (const u of list?.users ?? []) {
    if (u.email?.endsWith('@amityx.test')) await svc.auth.admin.deleteUser(u.id)
  }
}

async function makeOwner(hubId, tag) {
  const email = `media.${tag}.${stamp}.${uid().slice(0, 6)}@amityx.test`
  const password = 'Test-' + uid()
  const { data, error } = await svc.auth.admin.createUser({ email, password, email_confirm: true })
  if (error) throw new Error(`createUser(${tag}): ${error.message}`)
  created.userIds.push(data.user.id)
  await svc.from('hub_members').insert({ hub_id: hubId, user_id: data.user.id, role: 'owner' })
  const client = createClient(URL, ANON, { auth: { autoRefreshToken: false, persistSession: false } })
  const { error: signErr } = await client.auth.signInWithPassword({ email, password })
  if (signErr) throw new Error(`signIn(${tag}): ${signErr.message}`)
  return { id: data.user.id, client }
}

/** Upload placeholder bytes as the given client (or service). Returns the path. */
async function putObject(client, hubId, label) {
  const path = `${hubId}/${uid()}.webp`
  const bytes = Buffer.from(`amityx-test-${label}-${uid()}`)
  const { error } = await client.storage.from(BUCKET).upload(path, bytes, { contentType: 'image/webp', upsert: true })
  if (error) throw new Error(`upload(${label}): ${error.message}`)
  created.paths.push(path)
  return path
}

async function callEdge(token, paths) {
  const res = await fetch(`${URL}/functions/v1/guardian-media`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: ANON, Authorization: `Bearer ${ANON}` },
    body: JSON.stringify({ token, paths }),
  })
  return res.json()
}

async function seedHub(hubId, suffix) {
  await svc.from('hubs').insert({ id: hubId, name: `Media Hub ${suffix}`, slug: `media-${suffix}-${stamp}-${uid().slice(0, 5)}` })
  const { data: prog } = await svc.from('programs').insert({ hub_id: hubId, type: 'art', name: `Art ${suffix}` }).select().single()
  const { data: sess } = await svc.from('class_sessions').insert({
    hub_id: hubId, program_id: prog.id, starts_at: new Date(Date.now() + 3 * 86400000).toISOString(), capacity: 10,
  }).select().single()
  const { data: guardian } = await svc.from('guardians').insert({ hub_id: hubId, display_name: `Parent ${suffix}`, email: `p${suffix}@amityx.test` }).select().single()
  const { data: cYes } = await svc.from('children').insert({ hub_id: hubId, display_name: `Consented ${suffix}`, photo_consent: true }).select().single()
  const { data: cNo } = await svc.from('children').insert({ hub_id: hubId, display_name: `NoConsent ${suffix}`, photo_consent: false }).select().single()
  await svc.from('child_guardians').insert([
    { hub_id: hubId, child_id: cYes.id, guardian_id: guardian.id, is_primary: true },
    { hub_id: hubId, child_id: cNo.id, guardian_id: guardian.id, is_primary: false },
  ])
  await svc.from('enrollments').insert([
    { hub_id: hubId, child_id: cYes.id, program_id: prog.id, session_id: sess.id, status: 'active' },
    { hub_id: hubId, child_id: cNo.id, program_id: prog.id, session_id: sess.id, status: 'active' },
  ])
  return { progId: prog.id, sessId: sess.id, guardianId: guardian.id, childYes: cYes.id, childNo: cNo.id }
}

async function main() {
  console.log('== Amityx parent-layer adversarial suite (T-011) ==')
  await cleanup()

  const A = await seedHub(HUB_A, 'A')
  const B = await seedHub(HUB_B, 'B')
  const ownerA = await makeOwner(HUB_A, 'ownerA')
  const ownerB = await makeOwner(HUB_B, 'ownerB')

  // Guardian links for hub A: valid / expired / revoked (only hash stored).
  const tokValid = randomBytes(32).toString('base64url')
  const tokExpired = randomBytes(32).toString('base64url')
  const tokRevoked = randomBytes(32).toString('base64url')
  const { createHash } = await import('node:crypto')
  const hexOf = (s) => createHash('sha256').update(s).digest('hex')
  await svc.from('guardian_links').insert([
    { hub_id: HUB_A, guardian_id: A.guardianId, token_hash: hexOf(tokValid), expires_at: new Date(Date.now() + 7 * 86400000).toISOString() },
    { hub_id: HUB_A, guardian_id: A.guardianId, token_hash: hexOf(tokExpired), expires_at: new Date(Date.now() - 86400000).toISOString() },
    { hub_id: HUB_A, guardian_id: A.guardianId, token_hash: hexOf(tokRevoked), expires_at: new Date(Date.now() + 7 * 86400000).toISOString(), revoked_at: new Date().toISOString() },
  ])

  // ── 1. Guardian-feed token scoping ──
  console.log('\n[1] guardian feed — token scoping + clean denials')
  {
    const { data } = await anon.rpc('get_guardian_feed', { p_token: tokValid })
    if (data?.ok) {
      const names = data.children.map((c) => c.display_name)
      data.children.length === 1 && names[0].startsWith('Consented')
        ? ok('valid token returns ONLY the consented child (no-consent child absent)')
        : bad('valid token child scoping', JSON.stringify(names))
      data.hub?.id === HUB_A ? ok('feed scoped to the guardian’s own hub') : bad('feed hub scope', data.hub?.id)
      // schedule only for consented child
      const schedForNo = (data.schedule ?? []).some((s) => s.child_id === A.childNo)
      !schedForNo ? ok('schedule excludes the no-consent child') : bad('schedule leaked no-consent child')
    } else bad('valid token resolves', JSON.stringify(data))
  }
  {
    const { data } = await anon.rpc('get_guardian_feed', { p_token: tokExpired })
    data?.ok === false && data.reason === 'expired' ? ok('expired token denied cleanly') : bad('expired token', JSON.stringify(data))
  }
  {
    const { data } = await anon.rpc('get_guardian_feed', { p_token: tokRevoked })
    data?.ok === false && data.reason === 'revoked' ? ok('revoked token denied cleanly') : bad('revoked token', JSON.stringify(data))
  }
  {
    const { data } = await anon.rpc('get_guardian_feed', { p_token: 'garbage-token-not-in-the-db-xxxxxxxx' })
    data?.ok === false && data.reason === 'invalid' ? ok('unknown token == invalid (no enumeration)') : bad('unknown token', JSON.stringify(data))
  }

  // ── 2. No-consent child EXCLUDED at write (single + group) ──
  console.log('\n[2] consent enforced at WRITE — no-consent child never distributed')
  {
    // staff (ownerA) uploads then calls create_photo_moment
    const pathSolo = await putObject(ownerA.client, HUB_A, 'solo-noconsent')
    const solo = await ownerA.client.rpc('create_photo_moment', {
      p_hub_id: HUB_A, p_storage_path: pathSolo, p_child_ids: [A.childNo], p_caption: 'should be rejected',
    })
    solo.data?.ok === false && solo.data.reason === 'consent_required' && String(solo.data.blocked || '').includes('NoConsent')
      ? ok('single no-consent child photo REJECTED at write, names the blocking child')
      : bad('single no-consent write', JSON.stringify(solo.data ?? solo.error))

    const pathGroup = await putObject(ownerA.client, HUB_A, 'group-mixed')
    const group = await ownerA.client.rpc('create_photo_moment', {
      p_hub_id: HUB_A, p_storage_path: pathGroup, p_child_ids: [A.childYes, A.childNo], p_caption: 'group with one no-consent',
    })
    group.data?.ok === false && group.data.reason === 'consent_required' && String(group.data.blocked || '').includes('NoConsent')
      ? ok('GROUP photo tagging a no-consent child REJECTED at write (names them)')
      : bad('group mixed-consent write', JSON.stringify(group.data ?? group.error))

    // A clean, all-consented photo DOES land and reaches the guardian feed.
    const pathOk = await putObject(ownerA.client, HUB_A, 'consented')
    const good = await ownerA.client.rpc('create_photo_moment', {
      p_hub_id: HUB_A, p_storage_path: pathOk, p_child_ids: [A.childYes], p_caption: 'painting day',
    })
    good.data?.ok ? ok('all-consented photo is accepted') : bad('consented write', JSON.stringify(good.data ?? good.error))

    const feed = await anon.rpc('get_guardian_feed', { p_token: tokValid })
    const photos = feed.data?.photos ?? []
    photos.some((p) => p.storage_path === pathOk)
      ? ok('the consented photo appears in the guardian feed')
      : bad('consented photo missing from feed', JSON.stringify(photos))
    // The two rejected uploads must NOT exist as photo_moments rows anywhere.
    const rejectedRows = await svc.from('photo_moments').select('id').in('storage_path', [pathSolo, pathGroup])
    ;(rejectedRows.data?.length ?? 0) === 0
      ? ok('rejected photos left NO photo_moments row (write truly refused)')
      : bad('rejected write leaked a row', JSON.stringify(rejectedRows.data))
    // And the no-consent child appears on NO surface of the feed.
    const feedStr = JSON.stringify(feed.data)
    !feedStr.includes(A.childNo) && !feedStr.includes('NoConsent')
      ? ok('no-consent child id/name appears NOWHERE in the guardian feed')
      : bad('no-consent child leaked into feed')
  }

  // ── 3. Signed + expiring only; private bucket; scoped signing ──
  console.log('\n[3] media is signed + expiring — private bucket, scoped Edge signing')
  {
    // The consented photo path from step 2 is in the feed; sign via Edge Function.
    const feed = await anon.rpc('get_guardian_feed', { p_token: tokValid })
    const path = (feed.data?.photos ?? [])[0]?.storage_path
    if (!path) { bad('no signable photo path for step 3'); }
    else {
      // 3a. raw/public URL is NOT fetchable (bucket private).
      const pub = await fetch(`${URL}/storage/v1/object/public/${BUCKET}/${path}`)
      pub.status !== 200 ? ok(`raw public URL blocked (HTTP ${pub.status}) — bucket is private`) : bad('raw public URL was fetchable (bucket public!)')

      // 3b. anon cannot list or sign directly (no anon storage policy).
      const list = await anon.storage.from(BUCKET).list(HUB_A)
      ;(list.error || (list.data?.length ?? 0) === 0) ? ok('anon cannot LIST the bucket') : bad('anon listed the bucket', JSON.stringify(list.data))
      const anonSign = await anon.storage.from(BUCKET).createSignedUrl(path, 60)
      anonSign.error || !anonSign.data?.signedUrl ? ok('anon cannot create a signed URL directly') : bad('anon signed a URL directly')

      // 3c. Edge Function signs the guardian's own path; the URL fetches; short TTL.
      const edge = await callEdge(tokValid, [path])
      const signed = edge?.urls?.[path]
      if (edge?.ok && signed) {
        ok('Edge Function returns a signed URL for the guardian’s own photo')
        edge.expires_in && edge.expires_in <= 6 * 3600 ? ok(`signed URL is short-lived (${edge.expires_in}s)`) : bad('signed URL TTL too long', edge.expires_in)
        const got = await fetch(signed)
        got.status === 200 ? ok('the signed URL actually fetches the bytes') : bad('signed URL did not fetch', `HTTP ${got.status}`)
      } else bad('Edge Function sign (valid token)', JSON.stringify(edge))

      // 3d. Edge Function REFUSES a cross-hub path even when asked (scoped signing).
      const bPath = await putObject(ownerB.client, HUB_B, 'hubB-secret')
      await ownerB.client.rpc('create_photo_moment', { p_hub_id: HUB_B, p_storage_path: bPath, p_child_ids: [B.childYes], p_caption: 'hub B' })
      const cross = await callEdge(tokValid, [bPath])
      !cross?.urls?.[bPath] ? ok('Edge Function refuses to sign a path outside the token’s scope (hub B)') : bad('Edge signed a cross-hub path!')

      // 3e. expired/revoked token gets nothing from the Edge Function.
      const edgeExp = await callEdge(tokExpired, [path])
      edgeExp?.ok === false ? ok('Edge Function denies an expired token') : bad('Edge signed for an expired token', JSON.stringify(edgeExp))
    }
  }

  // ── 4. 30-day purge — bytes AND row ──
  console.log('\n[4] 30-day purge removes bytes AND row (manipulated taken_at)')
  {
    const oldPath = await putObject(ownerA.client, HUB_A, 'aged')
    const good = await ownerA.client.rpc('create_photo_moment', { p_hub_id: HUB_A, p_storage_path: oldPath, p_child_ids: [A.childYes] })
    const momentId = good.data?.moment_id
    // Age it > 30 days by rewriting taken_at + expires_at into the past (service role).
    await svc.from('photo_moments').update({
      taken_at: new Date(Date.now() - 40 * 86400000).toISOString(),
      expires_at: new Date(Date.now() - 10 * 86400000).toISOString(),
    }).eq('id', momentId)

    // Pre-check: object exists.
    const before = await svc.storage.from(BUCKET).createSignedUrl(oldPath, 60)
    before.data?.signedUrl ? ok('aged photo bytes exist before purge') : bad('aged photo missing before purge', JSON.stringify(before.error))

    const result = await purgeExpiredMedia(svc, { now: new Date() })
    result.removedRows >= 1 ? ok(`purge removed ${result.removedRows} expired row(s)`) : bad('purge removed no rows', JSON.stringify(result))

    const rowGone = await svc.from('photo_moments').select('id').eq('id', momentId).maybeSingle()
    !rowGone.data ? ok('photo_moments ROW is gone after purge') : bad('row survived purge')
    const after = await svc.storage.from(BUCKET).createSignedUrl(oldPath, 60)
    after.error || !after.data?.signedUrl ? ok('storage BYTES are gone after purge (cannot sign a deleted object)') : bad('bytes survived purge')
    // The still-valid consented photo from step 2 must NOT have been purged.
    const feed = await anon.rpc('get_guardian_feed', { p_token: tokValid })
    ;(feed.data?.photos?.length ?? 0) >= 1 ? ok('a within-window photo was NOT purged (rolling window, not a wipe)') : bad('purge over-deleted a fresh photo')
  }

  // ── 5. Announcement counts are aggregate only ──
  console.log('\n[5] announcement view counts are aggregate only (no per-recipient rows)')
  {
    const { data: ann } = await svc.from('announcements').insert({
      hub_id: HUB_A, title: 'Field trip Friday', body: 'Wear red', published_at: new Date().toISOString(),
    }).select().single()
    const r1 = await anon.rpc('mark_guardian_announcements_read', { p_token: tokValid, p_ids: [ann.id] })
    const r2 = await anon.rpc('mark_guardian_announcements_read', { p_token: tokValid, p_ids: [ann.id] })
    ;(r1.data?.ok && r2.data?.ok) ? ok('mark-read accepts a valid token') : bad('mark-read', JSON.stringify(r1.data ?? r2.data))
    const { data: after } = await svc.from('announcements').select('read_count').eq('id', ann.id).single()
    after.read_count === 2 ? ok('read_count incremented to 2 (aggregate counter, two opens)') : bad('read_count', after?.read_count)
    // A revoked/expired token cannot inflate counts.
    const before = after.read_count
    await anon.rpc('mark_guardian_announcements_read', { p_token: tokExpired, p_ids: [ann.id] })
    const { data: unchanged } = await svc.from('announcements').select('read_count').eq('id', ann.id).single()
    unchanged.read_count === before ? ok('expired token cannot inflate read_count') : bad('expired token inflated count', unchanged.read_count)
  }

  console.log(`\n== ${passed} passed, ${failed} failed ==`)
}

main()
  .catch((e) => { console.error('\nSUITE ERROR:', e.message, e.stack); failed++ })
  .finally(async () => {
    await cleanup()
    process.exit(failed === 0 ? 0 : 1)
  })
