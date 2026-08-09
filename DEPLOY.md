# 🚀 Love Arcade — Deployment Guide (GitHub Pages + Render)

This guide takes the game from a placeholder page to a fully deployed
**frontend on GitHub Pages** connected to a **live backend on Render**.

---

## Current setup (already done in this repo)

| File              | Purpose                                                          |
| ----------------- | ---------------------------------------------------------------- |
| `index.html`      | GitHub Pages landing page. Loads Socket.IO from CDN, defines `window.SERVER_URL`, then loads `public/js/client.js`. |
| `public/js/`      | Home of your main frontend JavaScript file (`client.js`).        |
| `render.yaml`     | Render Blueprint → deploys the backend automatically.            |
| `server/index.js` | Express + Socket.IO server. Already uses `process.env.PORT` and allows CORS `*`. |

---

## Step 1 — Put your frontend JS in place

Your frontend JS needs to live at **`public/js/client.js`** (or another name —
just update the `<script src="...">` tag in `index.html` to match).

The one thing it must change: **how it connects the socket.**

Replace any line like:

```js
const socket = io.connect('http://localhost:3000');
```

with a connection to the `SERVER_URL` that `index.html` defines:

```js
const socket = io(window.SERVER_URL);
```

> If your file already uses `io('http://localhost:...')` / `io.connect(...)`,
> point it at `window.SERVER_URL` — that single variable is where you'll swap
> in the live backend URL.

---

## Step 2 — Deploy the backend on Render

### Option A — Automatic (render.yaml Blueprint) ⭐ recommended

1. Push `render.yaml` to GitHub (it's already in the repo after the next commit).
2. Go to **https://dashboard.render.com** → **New** → **Blueprint**.
3. Pick the **love-arcade** repository → **Apply**.
4. Render reads `render.yaml`, installs dependencies, and starts the service.
5. When it's live you'll get a URL like `https://love-arcade.onrender.com`.

### Option B — Manual (Web Service)

1. **New** → **Web Service** → connect the **love-arcade** GitHub repo.
2. Name: `love-arcade` · Environment: **Node** · Branch: `main` · Region: any.
3. **Build Command:** `npm install`
4. **Start Command:** `npm start`
5. Plan: **Free**.
6. Advanced → **Health Check Path:** `/health`
7. **Create Web Service.**

### ⭐ Start Command to paste

```
npm start
```

`npm start` runs `node server/index.js`, and the server already reads
`process.env.PORT` (Render sets this automatically) — no code changes needed.

---

## Step 3 — Point the frontend at your live backend

1. Open **`index.html`** and find:

   ```html
   <script>
       window.SERVER_URL = 'http://localhost:3000'; // TODO: replace with your Render backend URL
   </script>
   ```

2. Replace the value with your real Render URL, e.g.:

   ```html
   <script>
       window.SERVER_URL = 'https://love-arcade.onrender.com';
   </script>
   ```

3. Commit and push. GitHub Pages rebuilds automatically within a minute.

---

## Step 4 — Verify

1. Open **your GitHub Pages URL** (e.g. `https://Ombhavnani.github.io/love-arcade/`)
   — the game should load, not the placeholder.
2. Open DevTools → **Console** and confirm the socket connects (no failed
   connection to the Render URL).
3. Real test: Player 1 opens the site on one device and taps **CREATE GAME**;
   Player 2 opens it on another device and **JOINS** with the code.

---

## Troubleshooting

- **Mixed content error:** GitHub Pages is HTTPS, so your backend must be HTTPS
  too. Render provides HTTPS automatically — just use the `https://` URL.
- **Page loads but nothing connects:** check the Console for a blocked/errored
  WebSocket to your Render URL, then confirm the Render service is marked
  **Live** (not still deploying).
- **Render logs:** in the Render dashboard, open your service → **Logs** — you
  should see the ❤️ LOVE ARCADE banner after a successful start.
- **`.gitignore`:** `node_modules/`, `.DS_Store`, and `sessions.json` are
  already ignored — never commit `node_modules`.
