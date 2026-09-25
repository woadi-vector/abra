# Deploying a live tester link

Two different "links" exist for Abra:

| Link | What it does | Keys? | Cost |
|---|---|---|---|
| **Static demo** (`docs/`, GitHub Pages) | Plays the two pre-rendered example stories | none | free |
| **Live app** (this guide) | Testers **tell/type their own** story → real generation | yes (server-side) | pay-per-use |

This guide is for the **live app** — a real URL a couple of testers can use to create
their own stories. It hosts `server/index.mjs` (Express) with your API keys stored
**server-side** (never in the client, never in the repo).

## Deploy to Render (≈3 minutes, free tier)

1. Go to **[render.com](https://render.com)** and sign in (GitHub login is easiest).
2. **New +  →  Blueprint**, and select the **`woadi-vector/abra`** repo. Render reads
   [`render.yaml`](render.yaml) and proposes the `abra-demo` web service. Click **Apply**.
3. When prompted, set the environment variables:
   - `ANTHROPIC_API_KEY` — required.
   - `GEMINI_API_KEY` — optional, for real art (use your **rotated** key).
   - `DEMO_ACCESS_TOKEN` — invent a shared secret, e.g. `abra-testers-7fq2` (this gates
     the generation endpoints so a leaked URL can't burn your API budget).
4. Wait for the first deploy. Render gives you a URL like `https://abra-demo-xxxx.onrender.com`.

## Share this with testers

Give testers the URL **with the token**:

```
https://abra-demo-xxxx.onrender.com/?token=abra-testers-7fq2
```

The token is remembered for their browser session, so they only need it once. Voice
input needs **Chrome** + mic permission (typing and "Try an example" always work).

## Good to know

- **Cost/abuse:** every generated story calls Anthropic (+ Gemini for art). The token
  gate keeps out random traffic; still, only share the link with your testers. To stop
  all spend, **suspend** (or delete) the Render service; to invalidate the current link,
  change `DEMO_ACCESS_TOKEN` and reshare.
- **Cold start:** the free plan sleeps after ~15 min idle; the first request then takes
  ~30–60s. Upgrade to a paid instance to keep it warm.
- **Ephemeral disk:** rendered art is cached on disk and reset on redeploy/restart —
  fine for testing (stories just re-render).
- **Alternative host:** Railway/Fly work too — set the same env vars, build `npm install`,
  start `npm start`.
