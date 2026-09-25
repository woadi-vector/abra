# Abra — RevenueCat Test Store harness

A minimal Capacitor Android app wired to the RevenueCat Purchases SDK, built to
run the **purchase + restore** flow against the **Test Store** — no Google Play
developer account, no real store products, no real charges.

## What's in here

```
Abra/
├─ index.html            # paywall UI (subscription + credit pack on one screen)
├─ src/main.js           # RevenueCat wiring: configure, offerings, purchase, restore
├─ capacitor.config.json # appId com.vectorresearchlabs.abra, webDir "dist"
├─ package.json          # scripts: build / cap:sync / cap:run:android
└─ android/              # generated native project (Gradle)
```

Identifiers the app expects (must match the dashboard exactly):

| Thing        | Identifier               | Type                         |
|--------------|--------------------------|------------------------------|
| Subscription | `abra_unlimited_monthly` | Auto-renewing (monthly)      |
| Credit pack  | `abra_credits_10`        | **Consumable** (10 renders)  |
| Entitlement  | `full_access`            | Attached to the subscription |
| Offering     | `default`                | Holds both packages          |

**Credits vs. entitlement:** the subscription grants the `full_access`
entitlement (a permanent on/off flag → unlimited renders). The consumable credit
pack does **not** grant an entitlement — `src/main.js` credits a local balance
(+10) on purchase and spends one per render. In production, move that balance
server-side or use RevenueCat Virtual Currencies so it survives reinstalls.

---

## Part A — Dashboard / Test Store setup

> Once the RevenueCat AI Toolkit is active in a Claude session, it can create all
> of this for you. These are the manual steps in the meantime.

1. **Project** — at app.revenuecat.com, create a project named **Abra**.
2. **Test Store app** — add an app to the project and choose **Test Store** as
   the app type. This issues a **public SDK API key** shaped like
   `test_xxxxxxxxxxxxxxxxxxxxxxxx`.
3. **Products** (under the Test Store app):
   - `abra_unlimited_monthly` — Subscription, monthly, any test price.
   - `abra_credits_10` — Consumable, any test price.
4. **Entitlement** — create `full_access` and attach `abra_unlimited_monthly`
   to it. (Do **not** attach the credit pack.)
5. **Offering** — create/edit the `default` offering and add two packages:
   - **Monthly** (`$rc_monthly`) → `abra_unlimited_monthly`
   - **Custom** (id `credits_10`) → `abra_credits_10`
6. **Copy the Test Store public key** and paste it into `src/main.js`:
   ```js
   const REVENUECAT_TEST_STORE_API_KEY = 'test_your_real_key_here';
   ```

(Exact dashboard labels may shift over time; the objects above are what matter.)

---

## Part B — Build & run on Android

**Prerequisites** (not installed on this machine yet):
- **JDK 17+**
- **Android Studio** + Android SDK (set `ANDROID_HOME`)
- An emulator (AVD) or a physical device with USB debugging

Then:

```bash
npm install
npm run cap:sync        # builds web + copies into the android project
npm run cap:run:android # builds & launches on the emulator/device
```

(or `npm run cap:open:android` to open the project in Android Studio and Run ▶.)

---

## Part C — Make one Test Store purchase (confirm the entitlement flips)

1. Launch the app. The status banner shows **"Locked — no subscription and 0
   credits."** and the paywall lists **two** items (the monthly sub and the
   10-credit pack), both from the `default` offering.
2. Tap **Buy** on **Abra Unlimited (Monthly)**. The Test Store completes the
   purchase instantly — no Google Play prompt, no charge.
3. On success, `src/main.js` reads `customerInfo.entitlements.active` and the
   banner turns green: **"✓ full_access ACTIVE — unlimited renders."**
4. Tap **▶︎ Render a full story** — it renders without spending a credit
   (subscriber path), proving the gate reads the entitlement.
5. **Restore:** tap **Restore purchases** (optionally reinstall first). The SDK
   re-fetches `customerInfo`, `full_access` comes back active, and the banner is
   green again.

**Credit-pack path (optional):** buy **Abra Credits (10)** instead — the banner
shows **"Credits: 10 render(s) left"**, `full_access` stays inactive, and each
**Render** spends one credit. That's the intended split: subscription →
entitlement; credits → per-render app logic.

### Where to watch it happen
- **App banner** — the quickest signal (`full_access ACTIVE`).
- **Logcat** — the SDK logs at DEBUG (`Purchases.setLogLevel`), so you'll see the
  purchase + entitlement grant.
- **RevenueCat dashboard** → the Test Store customer / Customer History — the
  transaction and the active `full_access` entitlement appear there too.
