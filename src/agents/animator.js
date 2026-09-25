// Abra — Animator (V2, PREMIUM) — STUB ONLY, do not implement animation here.
// ----------------------------------------------------------------------------
// A short animated clip is a premium, paid-tier output (gates behind the
// subscription / a bigger credit pack). This file is the clean extension point:
// the interface a real animation step would implement, plus the premium gate.
//
// Why it can plug in cleanly: it consumes the SAME assembled Book — specifically
// each character's stable `canonical` + `seed` (character consistency is what
// makes animation viable) and the ordered pages. Nothing about the storybook
// path needs to change to add animation later.
// ----------------------------------------------------------------------------

export const ANIMATION = Object.freeze({
  output: 'short_animated_clip',
  tier: 'premium',
  status: 'stub', // v2 — not implemented
  requiresEntitlement: 'full_access', // RevenueCat entitlement (see src/main.js)
  creditCost: 10, // or spend a bigger credit pack
});

// What the demo shows on the "Make it move" button. Pure — safe to compute
// server-side and hand to the client. Real entitlement/credit state comes from
// RevenueCat in the app; the demo passes defaults (locked).
export function animationGate({ isSubscriber = false, credits = 0 } = {}) {
  const unlocked = isSubscriber || credits >= ANIMATION.creditCost;
  return {
    output: ANIMATION.output,
    tier: ANIMATION.tier,
    status: ANIMATION.status,
    unlocked,
    requiresEntitlement: ANIMATION.requiresEntitlement,
    creditCost: ANIMATION.creditCost,
    message: unlocked
      ? 'Premium animation is unlocked for this account.'
      : 'Short animated clips are a premium Abra output — unlock with a subscription or a credit pack.',
  };
}

/**
 * V2 EXTENSION POINT — intentionally not implemented.
 * A real implementation receives the assembled `book` (book.characters carry the
 * reusable `canonical` + `seed`; book.pages carry the ordered scenes) and returns
 * clip artifacts. Keep this signature so animation drops in without touching the
 * storybook pipeline.
 * @param {object} _book  the assembled Book from the Bookbinder
 * @param {object} [_opts]
 */
export async function animateBook(_book, _opts = {}) {
  throw new Error(
    'NotImplemented: short animated clips are a premium v2 output. This is a clean extension point only — wire a renderer here that consumes book.characters (canonical + seed) and book.pages.'
  );
}
