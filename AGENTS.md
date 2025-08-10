# AGENT GUIDELINES
- Do not start dev servers/watchers (Expo/Metro) during edits.
- Use `npm ci` (not `npm install`).
- Keep diffs small; avoid formatting rewrites.
- Don’t edit lockfiles unless adding/removing deps.
- If scripts must change, add a TEMP comment and keep them no‑op.
- Output: summary of changed files and test commands to run.
