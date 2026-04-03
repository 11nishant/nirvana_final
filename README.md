# Nirvana — Track 2 web app (Task 4)

Express API + React (Vite) UI for MRI screening: binary (CN vs AD) or multi-class (CN vs MCI vs AD). The server includes a **pseudo predictor** until you plug in your preprocessing and models.

## Run locally

```bash
npm install
npm run build
npm start
```

Open `http://localhost:3000` (API + static UI).

**Development** (API on 3000, Vite on 5173 with proxy):

```bash
npm install
npm run dev
```

Open `http://localhost:5173`.

---

## What to commit

**Include (source and config):**

| Path | Purpose |
|------|--------|
| `server/` | API |
| `client/` | UI source (`src/`, `index.html`, `vite.config.ts`, `tsconfig.json`, `package.json`) |
| `package.json` | Root scripts & dependencies |
| `package-lock.json` | Root lockfile (if present) |
| `client/package-lock.json` | Client lockfile (if present) |
| `railway.toml` | Railway build/start |
| `.github/workflows/` | CI (build on every push to `main`) |
| `.gitignore` | Ignores `node_modules`, `dist`, etc. |
| `.env.example` | Env template |
| `README.md` | This file |
| `Problem_Statement_Track2.pdf` | Optional (problem statement for judges) |

**Do not commit:**

- `node_modules/` (root or `client/`)
- `client/dist/` (built on CI/Railway via `npm run build`)
- `.env` (secrets)

Quick check before commit:

```bash
git status
```

You should **not** see `node_modules` or `client/dist` listed as new files.

---

## Manual steps on your machine

### 1) Use a repo rooted in this folder

Initialize Git **inside** `nirvana_final` (not your Windows user home directory):

```bash
cd path\to\nirvana_final
git init
git add .
git commit -m "Initial Task 4 web app: Express API + Vite UI + Railway config"
```

### 2) Push to GitHub (remote is already configured)

The local repo already has `origin` → `https://github.com/11nishant/nirvana_final.git`. From this folder run:

```bash
cd path\to\nirvana_final
git push -u origin main
```

GitHub does **not** accept account passwords over HTTPS anymore. Use one of these:

- **Git Credential Manager** (often installed with Git for Windows): the first `git push` may open a browser to sign in to GitHub.
- **Personal Access Token (classic):** [GitHub → Settings → Developer settings → Personal access tokens](https://github.com/settings/tokens) → generate with **repo** scope. When `git` asks for a password, paste the token.

If you see `remote origin already exists`, skip `git remote add` — only run `git push -u origin main`.

If the remote already has commits you need to keep, use `git pull origin main --rebase` before pushing instead of force-pushing.

### 3) Deploy on Railway

1. Log in at [railway.com](https://railway.com).
2. **New project** → **Deploy from GitHub** → select `11nishant/nirvana_final`.
3. Railway should pick up `railway.toml`: install → build → `npm start`.
4. In the service **Settings**, open **Networking** and **Generate domain** (or attach your own).
5. No extra env vars are required for the mock API; `PORT` is set by Railway automatically.

### 4) When your backend is ready

Replace the `pseudoPredict` logic in `server/index.js` (or call your Python/model service) and keep the JSON response shape compatible with `client/src/App.tsx`, or adjust the client to match your API.

---

## API (for your backend team)

- `POST /api/predict` — multipart fields: `scan` (file), `classificationMode` (`binary` | `multiclass`), optional `metadata` (CSV file).
- `GET /api/health` — health check.
