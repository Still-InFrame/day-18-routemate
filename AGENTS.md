# AGENTS.md

Session-continuity doc. Auto-loaded as project instructions at session start. Re-read at session start; propose appends to Project status / Changelog / Gotchas / Open threads when triggers fire (see Maintenance triggers). No secrets in this file.

## Project

Day 18 of Savion's 100 Day AI Build Challenge (one new app per day for 100 days). Single user (Savion).

- **routemate** — _one-line description (fill in)._
- Stack: Next.js + TypeScript + Tailwind (App Router) + Supabase + Google auth
- Dev / build / test commands: _(fill in once the stack is set up)_
- Scaffolded: 2026-06-18

## Challenge context (constant across all 100 days)

- Each app is self-contained: its own folder (`day-NN-slug`), its own git repo, its own optional deploy. Apps do NOT share a codebase.
- The tracker at **https://100dayaichallenge.com** is a separate hub — log each finished app there with its repo + demo link. This project does not touch the tracker's code.
- **Ship it (per-app, after the app works) — two helper scripts the scaffolder dropped in:**
  - **`./backup.sh`** → creates this app's GitHub repo + pushes (gh CLI + SSH key). Public by default (build-in-public); `./backup.sh --private` for private; `./backup.sh "message"` sets the commit message. Re-run anytime to push new commits.
  - **`./deploy.sh`** (web apps only) → deploys to Vercel + attaches `<slug>.100dayaichallenge.com` (auto DNS + SSL, since Vercel runs the domain's DNS), then **syncs the live URL back to GitHub**: sets the repo Website field + adds a `**Live:**` line to the README + pushes. Order-independent and idempotent — run it before or after publishing; the URL always lands in the repo with no manual step.
  - Not every app needs deploying; a GitHub repo link is a fine demo.
- Not every app needs deploying. The challenge is to BUILD one a day; a repo link is a valid demo. Don't let "must deploy" threaten the streak.
- **Supabase apps share the "100-day-sandbox" project** (`byvkbrctizkhaoitxlkx`), separate from the tracker's project. `new-day.sh` already pre-filled `.env.local`, so this app connects on first `npm run dev`. To add data: create THIS app's tables in the sandbox SQL editor, **prefixing names per app** (`<slug>_*`) to keep it tidy; RLS isolates per user. **Auth is fully wired on the sandbox** (Google enabled, reusing the Day-1 OAuth client; a `https://*.100dayaichallenge.com/**` wildcard redirect covers every subdomain app) — so `web+supabase+auth` apps log in with NO per-app auth setup. Just deploy and sign in via the app's `*.100dayaichallenge.com` subdomain (not the raw `*.vercel.app` URL). An app for **real external users** should get its own Supabase project instead of the shared sandbox.
- **SESSION-START key check:** if this app has a `.env` / `.env.local` containing an EMPTY required secret (e.g. `ANTHROPIC_API_KEY=`), prompt Savion to paste the real value before running anything. He keeps keys local (gitignored), never committed — so the scaffolder leaves them empty for him to fill.

## Publishing (when the app is done and ready for the public)

Say "publish it" → Codex does steps 1–2, then runs the script in step 3.

1. **Trim dead weight.** Run `npx --yes --cache /tmp/npm-cache knip` to find unused files, deps, and exports. Review the report and remove only what is *genuinely* unused — confirm nothing references it (watch for dynamic imports, asset paths in JSX/CSS, config). Also drop leftover scaffold boilerplate (unused default SVGs/favicon if replaced). NEVER blind-delete from the report — judgment required.
2. **Write README.md** so a stranger gets it at a glance:
   - What the app does + key features
   - `## Screenshot` embedding `![screenshot](./public/screenshot.png)` (publish.sh generates the image)
   - `## Install` with: `git clone https://github.com/Still-InFrame/<this-folder>.git`, then `npm install`, then the run command
   - The stack, and a link to the tracker: https://www.100dayaichallenge.com/share/savion
3. **Run `./publish.sh`.** It (a) hard-gates on a **dual-engine secret scan** of staged content — `betterleaks` (broad ruleset) **plus** a native check for Supabase's `sb_secret_`/`sb_publishable_` keys (betterleaks has no rule for those yet, verified 2026-06 — it would let them through); either engine aborts the push; (b) screenshots the running app into `public/screenshot.png` (web apps); (c) creates the PUBLIC GitHub repo + pushes. No `--validation` flag, so the scan makes zero network calls.

Secrets live ONLY in `.env.local` (gitignored), read via `process.env` — never hardcode them. publish.sh blocks the push if any slip into tracked files. (`./backup.sh` stays the quick checkpoint push during the build; `./publish.sh` is the full go-public flow.)

## Working agreements

Behavior overrides — constant for Savion across every project. Adjust per-project only if he says so.

- Communication: verbose. Walk through reasoning before/after meaningful actions; show options considered. One or two sentences of explanation by default, more when novel or risky.
- Decisions with real tradeoffs: present 2–3 options, mark one Recommended, wait for Savion (use AskUserQuestion). Don't pick silently.
- Engineering honesty: push back when something is off — scope creep, over-engineering, premature abstraction, choices that hurt later. Don't sugarcoat.
- Diagnose root cause before patching. Don't paper over symptoms.
- Comments explain WHY, not WHAT. No emoji in code or docs (product/UI emoji is fine — it's not author voice).
- Match scope of action to scope of request. Don't add features beyond what was asked.
- Git: initialize early and push to GitHub for backup (the only Day-1 regret would have been losing un-backed-up work). Don't proactively commit without being asked; commit at meaningful checkpoints when Savion asks. Never amend, never force-push.
- Default later challenge days to LIGHTER scope than a full MVP unless Savion explicitly asks for max — Day 1 was special.

## Maintenance triggers

Read every session. Propose updates to this file when ANY fire — don't wait to be asked.

- **SESSION-START RULE:** re-read Project status before the first user message. If anything is In flight, surface it in one sentence and ask whether to continue or pivot. Don't assume continuation.
- **PROJECT STATUS:** work starts → "Add to In flight?"; work completes → "Move to Recently shipped + Changelog?"; "park it" → Parked; external blocker → Blocked (with reason + what unblocks).
- **CHANGELOG:** a feature shipped, a >15-min bug fix, an A-over-B architecture decision, a schema/contract change, or a change spanning multiple files. Record WHY, not just what.
- **GOTCHA:** a non-obvious framework/API quirk, an undocumented constraint that bit us, a race/timing bug, a TS/build edge case. Test: "would future-cold-me re-introduce this bug without a note?"
- **OPEN THREAD:** a temporary workaround replacing a real fix, a known limitation, an unresolved investigation (chronic caveats on existing code — distinct from in-motion Project status).
- **WORKING AGREEMENT:** Savion corrects the same thing twice, says "from now on do X," or "remember this."
- **CONVERSATIONAL CUES:** "this was tricky"/"I always forget this" → Gotcha; "park it" → Parked; "I'm stuck on/blocked by" → Blocked; re-asking something you should know → a missing entry; "we tried X, it didn't work" → Gotcha (what AND why).
- **PROACTIVITY:** after each meaningful unit of work, scan back; if a trigger fired, surface the proposal in one sentence (Savion can decline — ask anyway).
- **NEGATIVE RULE — don't pad:** typos, obvious one-liners, whitespace, reverts of just-tried things do NOT belong here. Bar = "would future-cold-me benefit?"

## Project status

### In flight
(none yet)

### Blocked
(none)

### Parked
(none)

### Recently shipped
(none yet)

## Changelog

Format — date, title, root cause/motivation, plumbing (files), tradeoffs. Reading cold, future-me must understand WHY.

- **2026-06-18**: Project scaffolded from the 100-day starter template.

## Open threads

(none yet — chronic caveats on existing code go here)

## Gotchas

Pre-seeded machine/environment lessons (true on this Mac regardless of app). Add project-specific ones as they come up.

- **npm global installs fail on this machine.** `npm i -g <pkg>` hits EACCES in `~/.npm/_cacache` (root-owned files) AND needs root for the global prefix. Don't use `sudo` (needs a password). Workaround: run CLIs via `npx --yes --cache /tmp/npm-vercel-cache <pkg>@latest <cmd>` — the `--cache` flag dodges the corrupted cache, npx dodges the global prefix.
- **The login shell is zsh; `$VAR` holding a multi-word command does NOT word-split.** `P='npx ... cli'; $P run` fails ("no such file or directory: npx ... cli"). Write the full command inline, or use `${=P}`.
- **`create-next-app` (and similar) reject folder names with spaces/capitals** — they derive the npm package name from the folder. Day folders are already named URL-safe (`day-NN-slug`) by the starter script, so this is avoided as long as you scaffold INTO this folder (e.g. `create-next-app .`).
- **If a `package-lock.json` exists at `/Users/savionsmith/` (outside the project),** Next/Turbopack may pick the wrong workspace root. Fix with `turbopack.root: __dirname` in `next.config.ts` (only relevant for Next apps).

## Architecture

_(document routing/state/data-flow/module boundaries once they exist)_

## Key files

| Purpose | File |
|---|---|
| _(fill in as the app takes shape)_ | |
