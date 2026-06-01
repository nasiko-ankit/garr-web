# Nanda Index — Live Demo Setup

A self-contained demo of the **Nanda Index** (a "DNS for AI agent registries") running entirely on your local machine. It covers three actions in sequence:

1. **Register a Registry** into the Nanda Index
2. **Register an Agent** into that registry
3. **A2A Card Exchange** between two agents in different registries

The reference scenario is `search-agent@google.demo` ↔ `products-agent@meta.demo` — two agents in two different organisations exchange their signed AgentCards via the Nanda Index.

---

## 1 · Prerequisites

| Tool                | Version            | Notes                                          |
| ------------------- | ------------------ | ---------------------------------------------- |
| **Node.js**         | 20.x or 22.x       | `node --version`                               |
| **npm**             | 10+                | bundled with Node                              |
| **Docker Desktop**  | any current        | needed for Postgres                            |
| **Git**             | any                | for cloning                                    |
| **Free TCP ports**  | 3000, 3001, 4001, 4002, 5433 | nothing else should be listening |

Operating system: tested on **Windows 11 / PowerShell 7** and macOS. Linux works the same way.

> The commands below are written for **PowerShell**. On macOS / Linux, replace `$env:VAR = "value"` with `export VAR=value`.

---

## 2 · Clone the two repos

The system has two parts: the **backend** (`GARR` — the index server, Postgres-backed) and the **frontend** (`garr-web` — Next.js UI).

```powershell
mkdir nanda-demo
cd nanda-demo
git clone <BACKEND_REPO_URL> GARR
git clone <FRONTEND_REPO_URL> garr-web
```

> Replace `<...REPO_URL>` with the URLs that were shared with you.
> Both repos should be on their `dev` branch (or the branch you were pointed at).

---

## 3 · Install dependencies (one-time)

```powershell
cd nanda-demo\GARR
npm install

cd ..\garr-web
npm install
```

---

## 4 · Configure environment files

### 4a. Backend (`GARR/.env`)

```powershell
cd nanda-demo\GARR
copy .env.example .env
```

Open `.env` and confirm:

```
NODE_ENV=development
PORT=3000
DATABASE_URL=postgres://garr:garr@localhost:5433/garr
GARR_ROOT_PRIVATE_KEY_PEM_PATH=./dev-signing.pem
GARR_ROOT_KEY_ID=garr-dev-2026
GARR_DEMO_MODE=true
```

If `dev-signing.pem` does not exist in the repo root, generate it once:

```powershell
openssl genpkey -algorithm Ed25519 -out dev-signing.pem
openssl pkey -in dev-signing.pem -pubout -out dev-signing.pub.pem
```

### 4b. Frontend (`garr-web/.env.local`)

Create or copy `.env.local` with:

```
NEXT_PUBLIC_GARR_API_BASE_URL=http://localhost:3000
```

---

## 5 · Start Postgres + apply migrations

From `nanda-demo\GARR`:

```powershell
docker compose up -d
docker ps   # confirm "garr-postgres" is healthy on 5433->5432
npm run migrate
```

You should see:
```
applied 001_init.sql
applied 002_pending_registrations.sql
migrations done
```

> If a previous schema is stuck in the volume:
> ```powershell
> docker compose down -v
> docker compose up -d
> npm run migrate
> ```

---

## 6 · Run the three demo processes

Three long-running terminals + one one-shot terminal.

### Terminal 1 — Backend

```powershell
cd nanda-demo\GARR
$env:GARR_DEMO_MODE = "true"
npm run dev
```

Wait for:
```
Server listening at http://127.0.0.1:3000
DEMO MODE ACTIVE — verification disabled
```

### Terminal 2 — Seed (one-shot)

```powershell
cd nanda-demo\GARR
$env:GARR_DEMO_MODE = "true"
npx tsx --env-file=.env scripts/seed-demo.ts
```

You should see:
```
✓ google registered successfully
✓ meta registered successfully
```

> If `npm run demo:seed` errors with `'GARR_DEMO_MODE' is not recognized` on Windows, the `npx tsx ...` form above is the equivalent. A `cross-env` shim is in `package.json` — run `npm install` after pulling if you hit this.

### Terminal 3 — Mock Registry Access Points

```powershell
cd nanda-demo\GARR
npm run demo:rap
```

You should see:
```
  [google] RAP running on http://localhost:4001 (1 agents: search-agent)
  [meta]   RAP running on http://localhost:4002 (1 agents: products-agent)
```
**Leave this terminal open — closing it kills the RAPs and breaks Step C.**

### Terminal 4 — Frontend

```powershell
cd nanda-demo\garr-web
$env:PORT = "3001"
npm run dev
```

Wait for `http://localhost:3001`.

> The `$env:PORT = "3001"` is mandatory — the backend already owns port 3000. If the frontend takes 3000, it will silently call itself for API requests and every page will 404.

---

## 7 · Run the demo in the browser

Open **http://localhost:3001/demo**.

You should see a yellow **"DEMO MODE ACTIVE"** banner, a green **"Pre-flight OK"** badge, and three step cards.

> **About the pre-seed.** The seed script in section 6 already registers `google.demo` and `meta.demo` so the A2A Card Exchange in Step C has data to resolve. Step A below registers a **third** organisation live in the UI to demonstrate the registry-onboarding flow itself.

### Step A — Register a Registry

A brand-new organisation onboards itself into the Nanda Index.

1. Click **Open Register Registry**.
2. Fill in a new org (e.g. owner_id `acme`, domain `acme.demo`, contact `registrar@acme.demo`, RAP URL `http://localhost:4003` — no RAP needs to be running there, demo mode skips reachability).
3. Click **Generate keypair**, then **Submit registration**.
4. On the challenge page, click **Sign automatically**, then **Verify & complete**.

Green **"Registration complete"** panel with the signed serial.

### Step B — Register an Agent

Add a new agent into an already-registered organisation. The registry signs the AgentCard with its own Ed25519 root key.

1. Click **Open Register Agent**.
2. Registry dropdown shows **Google** and **Meta** (both pre-seeded in section 6). Pick **Google**.
3. Fill in:
   - Agent name: `analytics-agent`
   - Display name: `Analytics Agent`
   - Description: `Aggregates product usage analytics.`
   - Protocol: `a2a`
   - Capabilities: `analytics.query, analytics.report`
4. Click **Register agent (RAP will sign)**.

Green panel appears with `agent_id: google/analytics-agent` and `signed_by: google-agent-root-demo`. A deep-link reads "Try it on A2A Card Exchange" — click it to confirm the new agent is immediately resolvable through the index.

### Step C — A2A Card Exchange (the headline)

Two agents in different organisations discover each other through the Nanda Index and exchange their signed AgentCards.

1. Click **Open A2A Card Exchange**.
2. Inputs pre-filled: `search-agent@google.demo:global` ↔ `products-agent@meta.demo:global`.
3. Click **Run A2A exchange**.

Both columns turn green, every narration line ticks, IndexRecord + AgentCard JSON render on each side, and the big green **"Exchange complete"** card appears at the bottom with both `invocation_url` values.

Optional extra: replace one of the locators with **`analytics-agent@google.demo:global`** (the agent you registered in Step B) and click **Resolve this side** — confirms Step B → Step C end-to-end.

---

## 8 · Quick health probes

```powershell
curl http://localhost:3000/health
curl http://localhost:3000/api/v1/owners/google
curl http://localhost:3000/api/v1/owners/meta
curl http://localhost:3000/global_agent_root.json
curl http://localhost:4001/agents.json
curl http://localhost:4002/agents.json
curl "http://localhost:3000/api/v1/resolve?locator=search-agent@google.demo:global"
```

---

## 9 · Troubleshooting

| Symptom | Cause | Fix |
| ------- | ----- | --- |
| `'GARR_DEMO_MODE' is not recognized` | Windows shell doesn't accept bash env-var prefix | Use `$env:GARR_DEMO_MODE = "true"; npx tsx ...` shown above |
| `ECONNREFUSED 127.0.0.1:5433` | Postgres container down | `docker compose up -d` |
| `column "actor" of relation "audit_log" does not exist` | Stale Postgres volume | `docker compose down -v && docker compose up -d && npm run migrate` |
| Frontend **"Failed to load registries: 404"** on Register Agent | Frontend grabbed port 3000 — calling itself | Restart frontend with `$env:PORT = "3001"` |
| **503 "AgentCard ... unreachable"** on A2A Exchange | Mock RAPs (Terminal 3) not running | `npm run demo:rap` |
| `409 owner_id already exists` when seeding | Old data in DB from a prior run | `docker compose down -v` for a fresh DB |

---

## 10 · Stopping everything

Ctrl+C in each long-running terminal. To also stop Postgres:

```powershell
cd nanda-demo\GARR
docker compose down       # add -v to also wipe the database volume
```
