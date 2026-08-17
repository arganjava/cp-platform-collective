#!/usr/bin/env node
/**
 * sync-env.mjs — copy .env / .env.local from the main repo into this worktree.
 *
 * Why: Freebuff builds each change set in an isolated git worktree
 * (e.g. /home/daytona/worktrees/<hash>) while the main repo lives next to them.
 * .env* files are gitignored, so a fresh worktree has no credentials
 * (e.g. NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY) — this script
 * copies them over so the app boots configured.
 *
 * Behavior:
 *  - Main repo is resolved relative to this script: <worktree>/../../codebase.
 *    Override with the MAIN_REPO_PATH env var.
 *  - Copies .env and .env.local when the destination is missing or older than
 *    the source. A newer local file is kept (your worktree-local edits win).
 *  - Set SYNC_ENV_FORCE=1 to always overwrite from the main repo.
 *  - Exits 0 (with a warning) when the main repo or a source file is missing,
 *    so `npm install` never fails on machines without the sibling repo.
 */
import { copyFileSync, existsSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const worktreeRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const mainRepo = resolve(
  process.env.MAIN_REPO_PATH || join(worktreeRoot, "..", "..", "codebase")
);
const force = process.env.SYNC_ENV_FORCE === "1";
const ENV_FILES = [".env", ".env.local"];

if (!existsSync(mainRepo)) {
  console.warn(
    `[sync-env] main repo not found at ${mainRepo} — skipping. ` +
      "Set MAIN_REPO_PATH to point at the repo that holds your .env files."
  );
  process.exit(0);
}

let copied = 0;
for (const file of ENV_FILES) {
  const src = join(mainRepo, file);
  const dest = join(worktreeRoot, file);

  if (!existsSync(src)) {
    console.warn(`[sync-env] ${file} not found in main repo (${mainRepo}) — skipping.`);
    continue;
  }

  const srcTime = statSync(src).mtimeMs;
  const destTime = existsSync(dest) ? statSync(dest).mtimeMs : 0;

  if (force || !existsSync(dest) || srcTime > destTime) {
    copyFileSync(src, dest);
    copied++;
    console.log(`[sync-env] copied ${file} <- ${mainRepo}`);
  } else {
    console.log(`[sync-env] ${file} already up to date in this worktree — keeping local copy.`);
  }
}

console.log(copied > 0 ? `[sync-env] done — ${copied} file(s) synced.` : "[sync-env] done — nothing to sync.");
