# Amityx — Hallway Test Protocol (run before public launch)

**Why:** the P.9 design law (D-012) says "if it needs explaining, redesign it." Automated
tests prove the flows *work*; only a real, untrained human proves they're *unconfusing*.
This is the one check a machine can't do. Do it once before you invite real hubs.

**Who to grab:** ONE non-technical person who has never seen Amityx — a friend, a parent,
a front-desk worker. NOT a developer. Ideally someone like our design target: a busy hub
owner, a 19-year-old part-time instructor, or a grandparent on a phone.

**What you need:** a laptop/phone for the signup test, and a tablet for the kiosk test.
Live site: **https://amityx.pages.dev**. Have a stopwatch. Say nothing while they work —
do not coach, hint, or touch the screen. Just watch and write down where they pause.

---

## Test 1 — Owner setup (target: done, unaided, in ≤15 minutes)
Hand them the laptop at the landing page and say exactly this, nothing more:

> "You run a little kids' activity business. Set it up on this so parents can book a spot."

Start the stopwatch. Watch for:
- **Where do they hesitate for >5 seconds?** (That screen failed the 5-second test.)
- Do they understand "hub", "Activities", "Classes", "public address/slug"? (Plain-words
  rule — if they ask "what's a hub?", that's a bug.)
- Do they get stuck at email verification? (They must open the confirmation email.)
- Can they finish — hub created, they land on the Today screen — without asking you?
- Note the **total time**. Over 15 min, or a dead end where they gave up = a bug.

## Test 2 — Kiosk check-in (target: they figure it out in one try)
Now hand them the **tablet**, already open to the class Today screen, and say:

> "A parent just walked up with their kid for class. Get the kid checked in."

Watch for:
- Do they find "Launch kiosk" (or "Open class")? Do they know to tap the child's tile?
- After tapping, is it obvious the child is now checked in? (The tile should clearly change.)
- Try to leave kiosk mode — is "Hold to exit" discoverable but not accidental?
- Anything they tap that does nothing, or any label they read out loud as a question.

## Test 3 (optional) — Parent link
Text/email them a `/g/{token}` family link on their own phone and say "you're a parent who
got this from the daycare." They should see only their child's classes/updates/photos with
NO login and no confusion. Watch for any "how do I sign in?" moment (there should be none).

---

## Recording what you see
For every hesitation, wrong turn, spoken question, or "I don't get this":
1. Note the **screen**, what they **expected**, and what **actually** happened.
2. File it as a bug: copy `framework/templates/BUG.md` to `context/bugs/B-###.md`.
   Severity **S2** if it confuses a core flow (booking, check-in, setup) or they can't
   finish; **S3** for a smaller stumble. Tie it to the P.9 rule it breaks (one-job-per-
   screen / 5-second / 3-tap / plain-words / button-labels / forgiving-errors).
3. If two of two testers hit the same wall, it's not them — it's the design. Fix before launch.

**Pass bar for launch:** one non-technical person completes owner setup AND a kiosk check-in
unaided, and nothing they hit is rated S2.
