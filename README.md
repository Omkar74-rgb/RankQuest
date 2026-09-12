# RankQuest

A gamified goals app: ranks, points, daily quests, personal goals, and a bucket
list, with AI-assigned point values, AI-generated "quest chains" for big
bucket-list items, an AI "Oracle" for motivation/strategy, missed-deadline
point penalties, multi-user accounts, and an admin dashboard.

Data is stored in **MongoDB** (e.g. a free MongoDB Atlas cluster) instead of
a local file, so it survives redeploys on any host without needing a
persistent disk/volume.

## 1. Get a database (2 minutes, free)

1. Go to https://www.mongodb.com/cloud/atlas/register and create a free account.
2. Create a free **M0** cluster (any region close to you).
3. Under **Database Access**, add a database user + password.
4. Under **Network Access**, add `0.0.0.0/0` (allow from anywhere) — simplest
   for getting started; you can restrict this later to your host's IP.
5. Click **Connect → Drivers**, copy the connection string. It looks like:
   `mongodb+srv://myuser:mypassword@cluster0.xxxxx.mongodb.net/rankquest`

## 2. Run it locally

```bash
npm install
cp .env.example .env
# open .env and set JWT_SECRET and MONGODB_URI
npm start
```

Open **http://localhost:3000**. The first account you register becomes the
admin automatically — no manual database editing needed.

## 3. Turn on real AI scoring

Without an API key, the app still works fully — it just uses a simple local
formula to estimate points instead of asking an AI. To get real AI-scored
points, quest chains, and Oracle insights, set **one** of these in `.env`:

- `ANTHROPIC_API_KEY=sk-ant-...` (Claude), or
- `GROK_API_KEY=xai-...` (xAI's Grok — OpenAI-compatible API, works fine here)

If both are set, Anthropic is used by default; set `AI_PROVIDER=grok` to
force Grok instead. Restart the server after changing `.env`.

## 4. How points, deadlines, and penalties work

- **Daily quests** expire at the end of each calendar day. Any quest not
  checked off by day's end loses a random 10-50% of its own point value from
  your total, then resets (available again the next day). Completing the same
  daily quest again later doesn't reset its lifetime completion count — the
  "Completed" tab shows it as e.g. "Drink water ×10".
- **Goals and bucket-list items** use a deadline you set when you add them.
  If the deadline passes before you mark it complete, the same random
  10-50% penalty is deducted once — the task stays open afterward so you can
  still finish it for its original point value. Once completed, the
  "Completed" tab shows the date it was finished.
- All of this is checked and applied server-side, on essentially every
  request, so it's always up to date without needing a background job.

## 5. Passwords

Per your request, passwords are currently stored and checked as **plain
text** — open `server/routes/auth.js` and you'll see this clearly marked,
with matching commented-out code for real hashing (using `bcryptjs`,
already included in `package.json`) directly below each plain-text line.
To turn on hashing:

1. Uncomment `const bcrypt = require("bcryptjs");` near the top of the file.
2. In `/register`, uncomment the `hashedPassword` line and change
   `passwordToStore` to `hashedPassword`.
3. In `/login`, uncomment the `hashedMatches` line and change
   `passwordMatches` to `hashedMatches`.

**Turn this on before you have real users if at all possible.** Existing
plain-text passwords won't automatically get hashed when you flip the
switch — that only affects new registrations/logins going forward.

## 6. The admin dashboard

Visit `/admin.html` while logged in as the admin account (the very first
account registered on the app). It lists every user with their rank, points,
streak, and task counts, and lets you click into any user to see their
individual tasks — read-only, straight from the database, no separate DB
tool needed.

## 7. Deploying it live — the simple path

**Recommended: Render (or Railway) as a single Web Service + MongoDB Atlas.**
Because the database is now Atlas (not a local file), the app host itself
needs zero persistent storage — any basic/free web service tier works, since
there's no disk to lose on redeploy.

1. Push this folder to a GitHub repo (`node_modules` excluded — see `.gitignore`).
2. On Render (or Railway), create a new **Web Service** from that repo.
3. Build command: `npm install`. Start command: `npm start`.
4. Set environment variables: `JWT_SECRET`, `MONGODB_URI`, and either `ANTHROPIC_API_KEY` or `GROK_API_KEY`.
5. Deploy. The app serves both the API and the frontend from one process —
   nothing else to configure, no volumes/disks to attach.

## 8. Before going live — a checklist

- [ ] Register your own account **first** so you're the admin, before anyone else signs up.
- [ ] Set a real, random `JWT_SECRET` (not the placeholder).
- [ ] Set `MONGODB_URI` to your Atlas connection string.
- [ ] Set `ANTHROPIC_API_KEY` or `GROK_API_KEY` if you want real AI scoring instead of local estimates.
- [ ] Decide on password hashing now (see section 5) — much easier before real users exist.
- [ ] Confirm your host serves the app over `https://` (Render/Railway do this by default).

## 9. Project structure

```
server/
  index.js       Express app entry point
  db.js          MongoDB connection (Mongoose)
  models.js      User and Task schemas
  auth.js        JWT helpers + auth middleware
  asyncHandler.js  Wrapper so async route errors don't hang requests
  settle.js      Deadline penalties, daily reset, streak logic
  tiers.js       Rank ladder definition
  ai.js          Calls to the Anthropic API (+ local fallbacks)
  routes/
    auth.js      register / login / me
    tasks.js     daily quests, goals, bucket list, quest chains
    oracle.js    AI "Oracle" insight
    admin.js     admin-only endpoints
public/
  index.html     login / register
  app.html       main app
  admin.html     admin dashboard
  css/styles.css
  js/            frontend logic (vanilla JS, no build step)
```
