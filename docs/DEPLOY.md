# Deploying

Free setup: **Neon** (Postgres) + **Render** (FastAPI backend) + **Vercel** (React frontend),
plus **GitHub Actions** for tests, deploys and the daily refresh.

## How deploys work

`.github/workflows/ci-cd.yml` runs on every pull request and every push to `master`:

1. **Backend tests** (ruff + pytest) and **Frontend tests** (eslint + vitest + build) run in parallel.
2. Only on `master`, and only if both pass: **Deploy backend** calls Render's deploy hook and
   **Deploy frontend** builds and ships the site with the Vercel CLI.

Render and Vercel's own auto-deploys are turned off (`autoDeploy: false` in `render.yaml`,
`git.deploymentEnabled: false` in `frontend/vercel.json`), so a failing test never goes live.
A pull request only runs the tests.

| Piece | Service | Plan | Notes |
|---|---|---|---|
| Database | Neon | Free | 1 GB per project, plenty for many leagues |
| Backend | Render | Free | Sleeps after 15 min idle; first visit then waits ~1 min. Starter ($7/mo) never sleeps |
| Frontend | Vercel | Hobby (free) | Static build of `frontend/` |
| Daily refresh | GitHub Actions | Free | `.github/workflows/daily-refresh.yml`, 06:00 UTC |

## 1. Database: Neon

1. Sign up at neon.tech with GitHub.
2. Create a project: name `fpl-league`, region **AWS Europe (Frankfurt)**, Postgres 17.
3. On the project dashboard, click **Connect** and copy the connection string
   (`postgresql://…neon.tech/neondb?sslmode=require…`). Keep it for step 2.

The backend creates its tables on first start; no migrations to run.

## 2. Backend: Render

1. Sign up at render.com with GitHub and allow access to the `fpl-fantasy` repo.
2. **New → Blueprint**, pick the repo. Render reads `render.yaml` and proposes the
   `fpl-league-api` web service.
3. Fill in the values it asks for:
   - `FPL_DATABASE_URL`: the Neon connection string from step 1.
   - `FPL_CORS_ORIGINS`: leave as `["http://localhost:5173"]` for now; fixed in step 4.
4. Click **Apply**. The first build takes a few minutes.
5. Copy the service URL, e.g. `https://fpl-league-api.onrender.com`, and check
   `https://…onrender.com/api/health` shows `{"status":"ok"}`.
6. In the service's **Environment** tab, copy the generated `FPL_REFRESH_TOKEN` (step 5).
7. In **Settings → Deploy Hook**, copy the hook URL (step 5). Treat it like a password.

## 3. Frontend: Vercel

1. Sign up at vercel.com with GitHub.
2. **Add New → Project**, import `fpl-fantasy`.
3. **Root Directory**: `frontend`. Framework preset: **Vite** (detected).
4. **Environment Variables**: `VITE_API_URL` = the Render URL from step 2 (no trailing slash).
5. **Deploy**. Because Git deploys are off, Vercel may create the project without
   building it; the pipeline does the first real deploy in step 5. The site URL is shown
   under **Domains**, e.g. `https://fpl-fantasy.vercel.app`.
6. Collect three values for step 5:
   - **Project ID**: Project → **Settings → General**.
   - **Team ID**: your team/account → **Settings → General**.
   - **Token**: Account → **Settings → Tokens** → create one named `github-actions`.

## 4. Connect them

In Render → `fpl-league-api` → **Environment**, set
`FPL_CORS_ORIGINS` = `["https://fpl-fantasy.vercel.app"]` (your Vercel URL, JSON list,
no trailing slash) and save. Render redeploys.

## 5. GitHub Actions: secrets and first run

In GitHub → repo **Settings → Secrets and variables → Actions**:

**Variables** tab:

| Name | Value |
|---|---|
| `API_URL` | the Render URL |

**Secrets** tab:

| Name | Value |
|---|---|
| `RENDER_DEPLOY_HOOK` | Render deploy hook URL |
| `VERCEL_TOKEN` | the Vercel token |
| `VERCEL_ORG_ID` | the Vercel Team ID |
| `VERCEL_PROJECT_ID` | the Vercel Project ID |
| `REFRESH_TOKEN` | the `FPL_REFRESH_TOKEN` value from Render |

Then, in the **Actions** tab:

1. **CI/CD → Run workflow** on `master`: all four jobs should go green, and the site goes live.
2. **Daily refresh → Run workflow**: all three steps should go green.

The deploy jobs use a GitHub **environment** named `production` (created automatically on the
first run). In **Settings → Environments → production** you can add a required reviewer if
you ever want to approve each deploy by hand.

## 6. Check

Open the Vercel URL on a phone, load a league, open each tab and a manager page.
After a 15-minute break, reload: it should wake within about a minute.

## Later

- **Stop the sleeping:** Render → service → **Settings → Instance type → Starter** ($7/mo).
  The daily Action can stay; it is harmless on an always-on server.
- **Own domain:** add it in Vercel → Project → **Domains**, then add the new address to
  `FPL_CORS_ORIGINS` on Render.
- **Logs:** Render → service → **Logs** (backend errors, daily refresh lines).
