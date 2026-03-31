# Deploy to Render (step-by-step)

Your code is on GitHub: **[github.com/PriyanshuMidha/attendance_system-](https://github.com/PriyanshuMidha/attendance_system-)**  
Deploy = **2 services on [Render](https://render.com/)** (API + static site) + **MongoDB Atlas** (database).

---

## Before you start (5 minutes)

1. **MongoDB Atlas**
   - Cluster running, database user created.
   - **Network Access** → add **`0.0.0.0/0`** (allow from anywhere) so Render can connect.  
   - Copy **connection string** (`mongodb+srv://USER:PASSWORD@...`) from **Connect → Drivers**.

2. **GitHub**
   - Repo access from your Render account: sign in to Render with GitHub and authorize the org/user that owns `attendance_system-`.

3. **Secrets**
   - Do **not** put `.env` in GitHub. You will paste `MONGODB_URI` only in the Render dashboard.

---

## Part 1 — Deploy the API (do this first)

1. Go to [dashboard.render.com](https://dashboard.render.com) → **New +** → **Web Service**.

2. **Connect repository** → pick **`PriyanshuMidha/attendance_system-`** → branch **`main`**.

3. Fill in:

   | Field | Value |
   |--------|--------|
   | **Name** | e.g. `attendance-api` |
   | **Region** | closest to you |
   | **Root Directory** | *(leave empty)* |
   | **Runtime** | **Node** |
   | **Build Command** | `npm install` |
   | **Start Command** | `npm start` |

4. Open **Environment** (same screen, scroll down) and add:

   | Key | Value |
   |-----|--------|
   | `MONGODB_URI` | Your full Atlas SRV string (include password; replace `<password>` if the URI template shows it). |
   | `MONGODB_DB` | `attendance` |
   | `MONGODB_COLLECTION` | `attendance managment` |

   Optional for now (add after Part 2):

   | Key | Value |
   |-----|--------|
   | `CORS_ORIGIN` | `*` temporarily **or** your static site URL once you have it (see Part 2). |

   **Do not** set `API_PORT` on Render — Render sets **`PORT`** automatically. If `API_PORT` is set here, the app used to listen on the wrong port and the deploy could fail; the server now prefers `PORT` on Render, but still remove `API_PORT` to avoid confusion.

5. Click **Create Web Service** and wait for deploy to finish (green “Live”).

6. **Copy your API URL** from the top of the service page, e.g.  
   `https://attendance-api-xxxx.onrender.com`

7. **Test in the browser:**  
   `https://YOUR-API-URL.onrender.com/api/health`  
   You should see JSON like `"mongo": true`. If `"mongo": false`, fix Atlas network access or `MONGODB_URI`.

> **Free tier:** first request after idle can take **30–60 seconds** (cold start).

---

## Part 2 — Deploy the website (static frontend)

1. On Render → **New +** → **Static Site**.

2. Connect **the same repo** → **`attendance_system-`** → branch **`main`**.

3. Fill in:

   | Field | Value |
   |--------|--------|
   | **Build Command** | `npm install && npm run build` |
   | **Publish Directory** | `dist` |

4. **Environment** → add **before** the first build completes (Vite reads this at build time):

   | Key | Value |
   |-----|--------|
   | `VITE_API_BASE` | `https://YOUR-API-URL.onrender.com` |

   **Rules:** no trailing `/`, and **do not** add `/api` (the app adds `/api` itself).

5. **Create Static Site** and wait for build + deploy.

6. Open the **static site URL** Render shows (e.g. `https://attendance-system-xxxx.onrender.com`). Log in with **`admin`** / **`qwerty`**.

---

## Part 3 — Fix CORS (if the site loads but data fails)

1. Go back to the **Web Service** (API) → **Environment**.

2. Set **`CORS_ORIGIN`** to your **exact** static site origin, e.g.  
   `https://attendance-system-xxxx.onrender.com`  
   (same as the URL in the browser address bar, **no** path at the end).

3. Remove `*` if you used it for testing.

4. **Manual Deploy** → **Clear build cache & deploy** (or Save and let it redeploy).

5. Hard-refresh the static site (Ctrl+Shift+R / Cmd+Shift+R).

---

## Quick checklist

- [ ] Atlas allows `0.0.0.0/0` (or Render IPs)
- [ ] Web Service: `npm install` / `npm start`, env has `MONGODB_URI`, `MONGODB_DB`, `MONGODB_COLLECTION`
- [ ] `/api/health` shows `"mongo": true`
- [ ] Static Site: `VITE_API_BASE` = API URL (no `/api`)
- [ ] API `CORS_ORIGIN` = static site `https://...` URL
- [ ] Login works on the live site

---

## Troubleshooting

| What you see | What to do |
|----------------|------------|
| Deploy **Exited with status 1** on `npm start` | Open **Web Service → Logs** and scroll **above** the “Exited with status 1” line — that line is only a summary; the real error is a few lines up (look for **`[startup]`**, **`MONGODB_URI`**, or **`MongoDB connection failed`**). Typical fixes: add **`MONGODB_URI`** (Atlas `mongodb+srv://…`), Atlas **Network Access** `0.0.0.0/0`, URL-encode special characters in the DB password, remove **`API_PORT`** from Render env, and do not use a **localhost** Mongo URI on Render. |
| Blank employees / network errors | Wrong `VITE_API_BASE` → fix env on **Static Site**, then **clear cache & redeploy** the static site. |
| Browser console: CORS blocked | Set `CORS_ORIGIN` on the **API** to the static URL exactly. |
| `/api/health` → `mongo: false` | Atlas IP allowlist, wrong password in URI, or user not allowed on DB. |
| 502 / timeout on API | Cold start — wait ~1 minute and retry; check **Logs** on the Web Service. |

---

## Optional: frontend on Vercel instead

1. Deploy the API on Render (Part 1 only).
2. [Vercel](https://vercel.com/) → New Project → import **`attendance_system-`**.
3. Framework: **Vite**, Output: **`dist`**, Build: `npm run build`.
4. Environment variable: **`VITE_API_BASE`** = your Render API URL.
5. On Render API, set **`CORS_ORIGIN`** to your Vercel URL (e.g. `https://your-app.vercel.app`).

---

## Security (production)

- Replace demo login **`admin` / `qwerty`** with real auth before public use.
- Never commit `.env`; rotate DB passwords if they were ever exposed.
- Prefer a specific `CORS_ORIGIN` instead of `*`.

---

## Links

- [Render — Web Services](https://render.com/docs/web-services)  
- [Render — Static Sites](https://render.com/docs/static-sites)  
- [MongoDB Atlas — Connect](https://www.mongodb.com/docs/atlas/getting-started/)
