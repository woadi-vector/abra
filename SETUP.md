# Setup & reproducibility

Everything needed to run Abra's demo and evals, plus the environment-specific
workarounds discovered while building it.

## Prerequisites

- **Node 18+** (developed on Node 24).
- A **Claude API key** (`ANTHROPIC_API_KEY`) to run the agents live. The offline
  eval checks need no key.
- No Android toolchain is needed for the web demo (see the Android note below).
- **Voice input requires Chrome** (Web Speech API `SpeechRecognition`) and mic
  permission. It's the primary input; typing and "Try an example" work in any
  browser as fallbacks. On a non-Chrome browser the mic button disables itself
  with a note.

## Install & run

```bash
npm install

# Claude key — server-side only, never in the client bundle.
cp .env.example .env          # then edit .env and paste your ANTHROPIC_API_KEY

npm run demo                  # → http://localhost:8787
```

Environment variables (all read server-side, see `.env.example`):

| Var | Default | Purpose |
|---|---|---|
| `ANTHROPIC_API_KEY` | — | Claude key. Required for live runs. |
| `ABRA_MODEL` | `claude-opus-5` | Override the model (e.g. a cheaper model for Guardian's classifier lanes). |
| `PORT` | `8787` | Demo server port. |

## Evals

```bash
npm run eval:offline          # no key — proves the eval/checker logic itself
npm run eval:storyteller      # live — 5 structure-preservation cases (+ LLM judge)
npm run eval:guardian         # live — block / pass-normal-play / flag test sets
npm run eval:output:offline   # no key — character consistency, layouts, premium stub
```

See [GUARDIAN.md](GUARDIAN.md) for what each suite proves.

## Security notes for contributors

- **Never commit a real key.** `.env` and `.claude/settings.local.json` are
  gitignored. The only committed key is the RevenueCat **public** `test_` SDK key
  in `src/main.js`, which is publishable by design.
- The Anthropic key is read from the environment only — never hardcoded, never
  bundled into the client. The agents (`src/agents/*`) run server-side (the demo
  server, or the Node eval harness); in a shipped app they run behind a backend
  proxy.

---

## RevenueCat setup (Test Store)

Abra uses a RevenueCat **Test Store** so purchases can be tested without a real
app store. The dashboard project (**Abra**) has:

- App: **Test Store** (no Google Play / App Store connection).
- Products: `abra_unlimited_monthly` (subscription) + `abra_credits_10` (consumable).
- Entitlement: `full_access` → attached to the subscription only.
- Offering: `default` with a monthly package + a custom `credits_10` package.

The Test Store **public** SDK key lives in `src/main.js`
(`REVENUECAT_TEST_STORE_API_KEY`). Full purchase walkthrough:
[README-TESTSTORE.md](README-TESTSTORE.md).

### Workaround: the RevenueCat MCP server was network-blocked

RevenueCat ships an MCP server (`https://mcp.revenuecat.ai/mcp`) that can
configure the dashboard from the editor. On the development machine it could
**not** connect: a network content filter (**SafeBrowse**) intercepted every TLS
connection to that specific host — the TLS handshake failed with
"wrong version number", and a plain HTTP request to the host returned
`302 → https://www.safebrowse.io/warn.html`. Only `mcp.revenuecat.ai` was
affected; `app.revenuecat.com` and `api.revenuecat.com` were reachable.

**Resolution:** the RevenueCat project was built **by hand in the web dashboard**
(`app.revenuecat.com`) — the MCP is a convenience, not a requirement. If you hit
the same block, either allowlist `mcp.revenuecat.ai` (ideally `*.revenuecat.ai`)
in your network filter, or configure the project in the dashboard directly. The
MCP can also be registered for when the domain is unblocked:

```bash
claude mcp add --transport http revenuecat https://mcp.revenuecat.ai/mcp
```

### Browser-automation quirks (dev workflow only)

Not needed to run the app — notes for anyone scripting the RevenueCat dashboard
(a React SPA) via browser automation:

- The browser pane must be **displayed/focused** or keyboard input silently
  no-ops (React only commits real keystrokes).
- Use **ref/element-based clicks**, not raw screenshot pixels (coordinate spaces
  differ).
- For number/price inputs, set the value via the form-input path — `Ctrl+A` /
  `Backspace` don't reliably clear them.
- Verify each field's value (via the DOM) before submitting.

---

## Android note

The demo is a **web app** (`npm run demo`) — no mobile toolchain required. The
Capacitor `android/` native project is gitignored and regenerable:

```bash
npm run build
npx cap add android          # regenerate the native project
npm run cap:run:android      # needs a JDK + Android SDK installed
```

Building/running the APK requires a JDK and the Android SDK (`ANDROID_HOME`),
which are not needed for the web demo or the evals.
