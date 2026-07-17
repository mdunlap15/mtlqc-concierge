# MTL+QC Concierge

Tiny proxy that lets the trip app talk to Claude without exposing an API key.

## Deploy on Railway (2 minutes)
1. Railway → New Project → **Deploy from GitHub repo** → pick `mtlqc-concierge`.
2. Variables: set `ANTHROPIC_API_KEY` (required). Optional: `MODEL` (default claude-sonnet-4-6), `TRIP_KEY` (default `mtlqc`).
3. Settings → Networking → **Generate Domain**. Copy the URL (e.g. `https://mtlqc-concierge-production.up.railway.app`).
4. Paste that URL into `config.js` in the `mtlqc-2026` repo (`CONCIERGE_URL`).

Health check: `GET /health` → `{ ok: true }`.
