# Deploying the Attendance & Salary Management System

This project is **two parts**:

1. **Backend** — Node.js + Express API (`server/index.js`) talking to **MongoDB Atlas**
2. **Frontend** — Vite + React (static files after `npm run build`)

You can host both on **[Render](https://render.com/)** (one **Web Service** + one **Static Site**). Alternatives like **Vercel** or **Netlify** only replace the **frontend**; the API still needs a Node host (Render, Railway, Fly.io, etc.).

---

## Prerequisites

- Code pushed to **GitHub** (or GitLab / Bitbucket — Render supports them).
- **MongoDB Atlas** cluster and connection string (`mongodb+srv://...`).
- In Atlas → **Network Access**: allow **`0.0.0.0/0`** (or Render’s egress IPs) so the API can connect.

---

## Option A — Everything on Render (recommended for this repo)

### Step 1: Deploy the API (Web Service)

1. Sign in at [render.com](https://render.com/) → **New +** → **Web Service**.
2. Connect your repository and select this project.
3. Configure:

   | Setting | Value |
   |--------|--------|
   | **Name** | e.g. `attendance-api` |
   | **Region** | Choose closest to users |
   | **Branch** | `main` (or your default branch) |
   | **Root directory** | *(leave empty — repo root)* |
   | **Runtime** | `Node` |
   | **Build command** | `npm install` |
   | **Start command** | `npm start` |

4. Under **Environment**, add (use **your** real values):

   | Key | Example / notes |
   |-----|------------------|
   | `MONGODB_URI` | Your Atlas SRV string |
   | `MONGODB_DB` | `attendance` |
   | `MONGODB_COLLECTION` | `attendance managment` (or your collection name) |
   | `NODE_VERSION` | `20` (optional; set in **Environment** or use `.nvmrc`) |

   **Do not** set `API_PORT` on Render — the platform sets **`PORT`**; the server already uses `process.env.PORT`.

5. **CORS** — After the frontend exists (Step 2), add:

   | Key | Value |
   |-----|--------|
   | `CORS_ORIGIN` | Your static site URL, e.g. `https://attendance-web.onrender.com` |

   Until the static URL exists, you can temporarily use `*` for testing only (not ideal for production).

6. Create the service. Copy the API URL, e.g. `https://attendance-api.onrender.com`.

7. Quick check: open `https://YOUR-API.onrender.com/api/health` — you should see JSON with `"mongo": true` (if Atlas is reachable).

**Free tier:** the API may **spin down after idle**; first request after sleep can take ~30–60s.

---

### Step 2: Deploy the frontend (Static Site)

1. **New +** → **Static Site** → same repository.
2. Configure:

   | Setting | Value |
   |--------|--------|
   | **Build command** | `npm install && npm run build` |
   | **Publish directory** | `dist` |

3. **Environment variables** (required **before** build — Vite bakes these in):

   | Key | Value |
   |-----|--------|
   | `VITE_API_BASE` | `https://YOUR-API.onrender.com` — **no** trailing slash, **no** `/api` suffix |

4. Deploy. Open the static URL and sign in (`admin` / `qwerty` for demo).

5. Go back to the **Web Service** and set **`CORS_ORIGIN`** to this static site URL exactly (scheme + host, no path). Redeploy the API if needed.

---

### Step 3: Repo checklist before deploy

- `.env` is **not** committed (it’s in `.gitignore`). Secrets go only in Render’s **Environment** UI.
- `package.json` includes `"start": "node server/index.js"` for the API service.

---

## Option B — Frontend on Vercel / Netlify, API on Render

Use this if you prefer Vercel’s CDN for the UI.

1. Deploy the **API** on Render exactly as in **Step 1** above.
2. On **Vercel** (or Netlify): import the same repo, framework **Vite**, build `npm run build`, output `dist`.
3. Set **`VITE_API_BASE`** = `https://YOUR-API.onrender.com` in the host’s environment (build-time for Vite).
4. Set Render **`CORS_ORIGIN`** to your Vercel URL, e.g. `https://your-app.vercel.app`.

---

## Which should you use?

| Setup | Pros |
|--------|------|
| **Render Web + Render Static** | One vendor, simple billing, good for class projects |
| **Vercel + Render API** | Very fast global static delivery; API stays on Render |

Both are valid; **Render-only** is enough for most school/demo deployments.

---

## Troubleshooting

| Problem | What to check |
|--------|----------------|
| Frontend loads but data never appears | `VITE_API_BASE` wrong; rebuild static site after changing it. Browser **Network** tab: API calls should go to your Render API domain. |
| CORS errors in the browser | `CORS_ORIGIN` on the API must **exactly** match the site origin (including `https://`). |
| API `/api/health` shows `mongo: false` | Atlas **Network Access**, wrong `MONGODB_URI`, or user lacks DB permissions. |
| 502 / connection refused | Web Service asleep (free tier) — wait and retry; or wrong **Start command** (`npm start`). |

---

## Security reminders (production)

- Change the demo login (**`admin` / `qwerty`**) to real authentication.
- Rotate any database password that was ever shared in chat or committed.
- Prefer **`CORS_ORIGIN`** = your real frontend URL instead of `*`.

---

## Reference

- [Render Docs — Web Services](https://render.com/docs/web-services)  
- [Render Docs — Static Sites](https://render.com/docs/static-sites)  
- [MongoDB Atlas connection](https://www.mongodb.com/docs/atlas/getting-started/)
