# Study Buddy

A self-hosted practice app for the Cambridge ESAT: pick subjects, take a timed multiple-choice
session, and review results afterwards. Questions you've previously gotten wrong (or been slow on)
are weighted to come up more often in later sessions. Subjects like Psychology also support
LLM-graded discussion activities — free-text questions judged for understanding (with follow-up
questions) rather than a fixed answer key; see "Claude CLI login" below for the one-time setup
these need.

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

## Deployment (Kamal)

The app ships with a `Dockerfile` and `config/deploy.yml` for deploying with
[Kamal](https://kamal-deploy.org/). It deploys to `study-buddy.spinorml.com`, sharing the same
host and `kamal-proxy` as the spinorml/teenygrad sites; TLS is terminated at Cloudflare in front of
it (`proxy.ssl: false`), matching that setup.

The database and uploaded images live in a named Docker volume (`study_buddy_data`, mounted at
`/data`, set via `STUDY_BUDDY_DATA_DIR`) so they survive every redeploy — a new image never touches
existing data.

Before deploying, export the one secret Kamal needs (see `.kamal/secrets`):

```bash
export KAMAL_REGISTRY_PASSWORD=...   # Docker Hub password/token for artemissoft1
```

`NUXT_SESSION_PASSWORD` is hardwired directly in `config/deploy.yml` (`env.clear`) rather than
treated as a secret — this app doesn't handle anything sensitive, so it's not worth the deploy-time
export friction. If you ever want it out of version control, move it back to `.kamal/secrets` and
`env.secret`.

First-time setup (provisions the proxy, builds, and starts the app):

```bash
kamal setup
```

Routine deploys after that:

```bash
kamal deploy
```

Useful commands: `kamal app logs`, `kamal app exec -i bash` (to run `npm run create-admin` inside
the running container), `kamal rollback`.

### Claude CLI login (for discussion activities)

LLM-graded discussion activities (see below) grade answers via the Claude Code CLI, running
headlessly inside the container and authenticated with your own Claude account rather than API
billing. The image has the CLI installed, but **you need to log it in once after first deploying**
(and again any time the admin dashboard shows a "Claude CLI needs re-authentication" banner):

```bash
kamal app exec -i "claude auth login --claudeai"
```

This prints an OAuth URL — open it on any device (it doesn't need to be the server), complete
sign-in, then paste the resulting code back into the terminal. Credentials are stored under
`claude-home/` inside the same persistent `/data` volume as the database, so login survives every
future redeploy; you only need to repeat this if the login itself expires or is revoked.

To check current status without waiting for a grading call to fail, either look for the banner on
the admin dashboard (it has a "Check now" button), or run directly:

```bash
kamal app exec -i "claude auth status --json"
```

### Manual / bare-metal alternative

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
