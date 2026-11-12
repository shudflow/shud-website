## Shudflow project docs (read first)

The product plan, architecture and team rules live in `docs/project/` in the shud-platform repo:
https://github.com/shudflow/shud-platform/tree/dev/docs/project

- Before any task, read `docs/project/05-team-rules.md`. For pricing, payments or architecture work, also read the matching file.
- If a task contradicts these docs, stop and ask; do not pick a side yourself.
- In shud-website there is no `dev` branch: work on a branch from `main`; finish with a pushed branch and a PR into `main`. Link the PR to its task: create the branch from the issue (Development → Create a branch, or `gh issue develop N`) or link the PR in the issue's Development box, and write `Refs #N` in the description. Never commit to `main` or `dev`, never push to someone else's branch, never force push, never merge without approval.
- Follow the board rules in `docs/project/05-team-rules.md`: move only cards you acted on; a reviewer moves a card only after posting their review. For several PRs, follow the least-complete PR; approval without merge stays Review. Done requires every needed PR merged and all task criteria met. After moving cards, report which ones and why.
- Never print, log or commit secrets or `.env` files.
- Stop only processes you started (by PID). Delete any extra branches or draft PRs you created before reporting.
