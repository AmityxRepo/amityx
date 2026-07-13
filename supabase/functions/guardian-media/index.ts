// ============================================================
// Amityx — guardian-media Edge Function (T-011)
//
// Why this exists: the parent layer is anonymous (no session). Supabase Storage
// signed URLs require a Storage SELECT grant on the object, and any anon SELECT
// policy broad enough to SIGN a known object is ALSO broad enough to LIST the
// whole bucket (same RLS gate) — which would let any anonymous visitor enumerate
// and sign EVERY child's photo. That is unacceptable for toddler media, so the
// 'photo-moments' bucket has NO anon storage policy at all (fully private).
//
// Instead, this function is the ONE capability that turns a valid guardian token
// into short-lived signed URLs, and ONLY for that guardian's own consented
// children. It re-derives the allowed path set server-side from the token via the
// get_guardian_feed RPC (the single source of consent+scope truth), then signs
// with the service-role key. A caller can never obtain a URL for a path outside
// their token's scope, even by sending arbitrary `paths`.
//
// $0: Edge Functions are free on Supabase's tier; deployed with `--use-api`
// (no Docker). Signed-URL TTL is short (2h) — the 30-day window governs when the
// underlying photo is purged, NOT how long a signed URL stays live.
// ============================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const SIGNED_URL_TTL_SECONDS = 60 * 60 * 2; // 2 hours
const BUCKET = "photo-moments";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ ok: false, reason: "method_not_allowed" }, 405);

  let token: string | undefined;
  let requestedPaths: string[] = [];
  try {
    const body = await req.json();
    token = typeof body?.token === "string" ? body.token : undefined;
    if (Array.isArray(body?.paths)) {
      requestedPaths = body.paths.filter((p: unknown): p is string => typeof p === "string");
    }
  } catch {
    return json({ ok: false, reason: "bad_request" }, 400);
  }

  if (!token || token.length < 20) return json({ ok: false, reason: "invalid" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) return json({ ok: false, reason: "server_misconfigured" }, 500);

  const svc = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Re-derive the allowed path set from the token — the RPC validates the token
  // (revoked/expired/invalid) AND consent-scopes every path it returns.
  const { data: feed, error } = await svc.rpc("get_guardian_feed", { p_token: token });
  if (error) return json({ ok: false, reason: "server_error" }, 500);
  if (!feed?.ok) return json({ ok: false, reason: feed?.reason ?? "invalid" });

  const allowed = new Set<string>();
  for (const p of feed.photos ?? []) if (p?.storage_path) allowed.add(p.storage_path);
  for (const a of feed.announcements ?? []) if (a?.image_path) allowed.add(a.image_path);

  // If the caller didn't specify paths, sign everything they're allowed to see.
  const toSign = requestedPaths.length > 0
    ? requestedPaths.filter((p) => allowed.has(p))
    : [...allowed];

  const urls: Record<string, string> = {};
  for (const path of toSign) {
    const { data: signed } = await svc.storage
      .from(BUCKET)
      .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
    if (signed?.signedUrl) urls[path] = signed.signedUrl;
  }

  return json({ ok: true, urls, expires_in: SIGNED_URL_TTL_SECONDS });
});
