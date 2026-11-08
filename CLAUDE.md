## Shudflow project docs (read first)

The product plan, architecture and team rules live in `docs/project/` in the shud-platform repo:
https://github.com/shudflow/shud-platform/tree/dev/docs/project

- Before any task, read `docs/project/05-team-rules.md`. For pricing, payments or architecture work, also read the matching file.
- If a task contradicts these docs, stop and ask; do not pick a side yourself.
- Work on a branch from fresh `dev`; finish with a pushed branch and a PR into `dev` that contains `Closes #N`. Never commit to `main` or `dev`, never push to someone else's branch, never force push, never merge without approval.
- Never print, log or commit secrets or `.env` files.
- Stop only processes you started (by PID). Delete any extra branches or draft PRs you created before reporting.
