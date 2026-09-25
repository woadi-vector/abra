import { Capacitor } from '@capacitor/core';
import { Purchases, LOG_LEVEL } from '@revenuecat/purchases-capacitor';

// ---------------------------------------------------------------------------
// CONFIG — fill these in from the RevenueCat dashboard.
// ---------------------------------------------------------------------------
// The PUBLIC SDK key of your Test Store app.
//   Dashboard → Project "Abra" → API keys → the key belonging to the Test Store
//   app. Test Store keys look like `test_xxxxxxxxxxxxxxxxxxxxxxxx`.
// This is a PUBLIC (SDK) key — safe to ship in the app. It is NOT the v2 secret
// key used by the AI toolkit / server API.
const REVENUECAT_TEST_STORE_API_KEY = 'test_dmDDUQRnbnBkhkYBaRdPfszNsGQ';

// Must match exactly what you create in the dashboard.
const ENTITLEMENT_ID = 'full_access';
const CREDIT_PACK_PRODUCT_ID = 'abra_credits_10';
const CREDITS_PER_PACK = 10;

// ---------------------------------------------------------------------------
// Local credit balance.
// Consumables do NOT grant a permanent entitlement — RevenueCat records the
// transaction, but tracking "how many renders are left" is the app's job.
// For this harness we keep the balance in localStorage. In production, track it
// server-side (or via RevenueCat Virtual Currencies) so it survives reinstalls.
// ---------------------------------------------------------------------------
const CREDITS_KEY = 'abra.credits';
const getCredits = () => Number(localStorage.getItem(CREDITS_KEY) || 0);
const setCredits = (n) => localStorage.setItem(CREDITS_KEY, String(Math.max(0, n)));

// ---------------------------------------------------------------------------
// DOM helpers
// ---------------------------------------------------------------------------
const el = (id) => document.getElementById(id);
const statusEl = el('status');
const paywallEl = el('paywall');

let isSubscriber = false;

function setStatus(msg, kind) {
  statusEl.textContent = msg;
  statusEl.className = 'status' + (kind ? ' ' + kind : '');
}

function renderAccessLine() {
  const credits = getCredits();
  if (isSubscriber) {
    setStatus('✓ full_access ACTIVE — unlimited renders (subscription).', 'unlocked');
  } else if (credits > 0) {
    setStatus(`Credits: ${credits} render(s) left. full_access is not active.`, 'unlocked');
  } else {
    setStatus('Locked — no subscription and 0 credits. Buy below to unlock full renders.', 'locked');
  }
}

// ---------------------------------------------------------------------------
// RevenueCat
// ---------------------------------------------------------------------------
async function applyCustomerInfo(customerInfo) {
  isSubscriber = !!customerInfo?.entitlements?.active?.[ENTITLEMENT_ID];
  renderAccessLine();
}

async function refreshCustomerInfo() {
  const { customerInfo } = await Purchases.getCustomerInfo();
  await applyCustomerInfo(customerInfo);
}

function packageCard(pkg) {
  const p = pkg.product;
  const card = document.createElement('div');
  card.className = 'card';

  const title = document.createElement('h3');
  title.textContent = p.title || pkg.identifier;

  const sub = document.createElement('div');
  sub.className = 'sub';
  sub.textContent = p.description || '';

  const btn = document.createElement('button');
  btn.innerHTML = `Buy · <span class="price">${p.priceString}</span>`;
  btn.addEventListener('click', () => buy(pkg, btn));

  card.append(title, sub, btn);
  return card;
}

async function loadOfferings() {
  const offerings = await Purchases.getOfferings();
  const current = offerings.current;
  paywallEl.innerHTML = '';

  if (!current || current.availablePackages.length === 0) {
    paywallEl.textContent = 'No packages in the current offering. Check the "default" offering in the dashboard.';
    return;
  }
  // Both the subscription and the credit pack live in the same offering, so
  // they render together on this single paywall.
  for (const pkg of current.availablePackages) {
    paywallEl.appendChild(packageCard(pkg));
  }
}

async function buy(pkg, btn) {
  const label = btn.innerHTML;
  btn.disabled = true;
  btn.textContent = 'Purchasing…';
  try {
    const { customerInfo, productIdentifier } = await Purchases.purchasePackage({ aPackage: pkg });

    // Consumable credit pack: RevenueCat won't mark an entitlement, so we
    // credit the local balance ourselves.
    if (productIdentifier === CREDIT_PACK_PRODUCT_ID) {
      setCredits(getCredits() + CREDITS_PER_PACK);
    }
    await applyCustomerInfo(customerInfo);
  } catch (e) {
    if (!e?.userCancelled) {
      setStatus('Purchase failed: ' + (e?.message || e), 'locked');
    }
  } finally {
    btn.disabled = false;
    btn.innerHTML = label;
  }
}

async function restore() {
  setStatus('Restoring…');
  try {
    const { customerInfo } = await Purchases.restorePurchases();
    await applyCustomerInfo(customerInfo);
  } catch (e) {
    setStatus('Restore failed: ' + (e?.message || e), 'locked');
  }
}

// "Render a full story" — the gate the entitlement/credits protect.
function renderStory() {
  if (isSubscriber) {
    setStatus('✓ Rendering a full, watermark-free story (subscription).', 'unlocked');
    return;
  }
  const credits = getCredits();
  if (credits > 0) {
    setCredits(credits - 1);
    setStatus(`✓ Rendered — 1 credit spent. ${getCredits()} left.`, 'unlocked');
    return;
  }
  setStatus('Locked — buy the subscription or a credit pack to render.', 'locked');
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
async function init() {
  el('restore-btn').addEventListener('click', restore);
  el('render-btn').addEventListener('click', renderStory);

  if (Capacitor.getPlatform() === 'web') {
    setStatus(
      'Running in the browser — RevenueCat purchases need the native layer. ' +
      'Build and run on Android: npm run cap:run:android',
      'locked'
    );
    paywallEl.textContent = 'Paywall loads on-device (Android).';
    return;
  }

  if (REVENUECAT_TEST_STORE_API_KEY.includes('REPLACE')) {
    setStatus('Set REVENUECAT_TEST_STORE_API_KEY in src/main.js (Test Store public key).', 'locked');
    return;
  }

  try {
    await Purchases.setLogLevel({ level: LOG_LEVEL.DEBUG });
    await Purchases.configure({ apiKey: REVENUECAT_TEST_STORE_API_KEY });
    await refreshCustomerInfo();
    await loadOfferings();
  } catch (e) {
    setStatus('RevenueCat init failed: ' + (e?.message || e), 'locked');
  }
}

document.addEventListener('DOMContentLoaded', init);
