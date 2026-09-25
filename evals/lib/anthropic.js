// Shared Anthropic client factory for Abra's agents (Storyteller, Guardian) and
// their eval harnesses.
//
// IMPORTANT: this module (and anything that imports the SDK) is TOOLING / SERVER
// code. The public SDK key must never ship in the Capacitor client bundle. In
// the app, the agents run behind a backend proxy that holds the key; here in the
// evals they run in Node, where the SDK resolves credentials from the
// environment (ANTHROPIC_API_KEY, ANTHROPIC_AUTH_TOKEN, or an `ant auth login`
// profile).
import Anthropic from '@anthropic-ai/sdk';

// Default to the latest, most capable Claude model. Override per-run with
// ABRA_MODEL for cheaper passes (e.g. ABRA_MODEL=claude-haiku-4-5 for the
// Guardian classifier lanes).
export const DEFAULT_MODEL = process.env.ABRA_MODEL || 'claude-opus-5';

export function makeClient() {
  // Zero-arg constructor resolves credentials from the environment.
  return new Anthropic();
}

// True when *some* credential source is plausibly available. Used by runners to
// print a helpful message instead of a raw 401 when nothing is configured.
export function hasCredentials() {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}
