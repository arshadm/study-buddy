# Study Buddy

A self-hosted practice app for the Cambridge ESAT: pick subjects, take a timed multiple-choice
session, and review results afterwards. Questions you've previously gotten wrong (or been slow on)
are weighted to come up more often in later sessions.

Built with Nuxt 3, Nuxt UI, SQLite (via Drizzle ORM), and `nuxt-auth-utils` for login.

## Setup

```bash
npm install
cp .env.example .env
```

Edit `.env`:
- `NUXT_SESSION_PASSWORD` — a long random string (`openssl rand -base64 32`), used to encrypt login sessions.
- `STUDY_BUDDY_DATA_DIR` — where the SQLite database and uploaded question images are stored. Defaults to `./.data` for local dev. In production, point this at a persistent directory **outside** the app's deploy/build folder (e.g. `/var/lib/study-buddy`), since it must survive rebuilds.

## Development

```bash
npm run dev
```

On first run, the database is created and migrated automatically. If no admin account exists yet,
one is auto-created and its username/password are printed once to the console — use those to log in
and change the password, or instead create your own from the start:

```bash
npm run create-admin -- --username dad --password "your-password" --name "Dad"
```

Re-run with `--reset` to change an existing admin's password.

## Production

```bash
npm run build
NUXT_SESSION_PASSWORD=... STUDY_BUDDY_DATA_DIR=/var/lib/study-buddy node .output/server/index.mjs
```

Run this behind a process manager (pm2, systemd, etc.) and a reverse proxy for TLS. The data
directory (database + uploaded images) is independent of the build output, so redeploying
(`npm run build` again) never touches existing data.

## Schema changes

```bash
npm run db:generate   # after editing server/database/schema.ts
npm run db:migrate     # apply migrations manually if needed (also runs automatically on startup)
```
