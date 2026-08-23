# BoobaStudio agent workflow

## Delegation policy

For routine, well-scoped implementation work, delegate the first coding pass to
the local `qwen3.8:27b` worker before editing the repository yourself:

```bash
node scripts/qwen-delegate.mjs --label "short-task-name"
```

Provide the task specification on standard input. The wrapper gives Qwen
constrained repository tools for listing, searching, reading, checking, and
applying patches. Qwen may edit files inside this repository, but must not
commit, push, publish releases, change credentials, or perform destructive
operations. The coordinating agent must review the diff, run the relevant
checks, and own the final integration.

Retain the task directly for architecture, security-sensitive provider work,
browser/live testing, release publication, destructive operations, or when the
worker is unavailable. In that case, record the reason in the final report.

Every delegation is recorded locally in `logs/qwen-delegations.jsonl`; that
directory is intentionally ignored by Git and must never contain prompts,
credentials, API keys, or provider responses.

## Repository rules

- Preserve the existing Cibola-derived structure and Foundry integrations.
- Never commit secrets, API keys, passwords, or live provider responses.
- Do not let Qwen create commits; the coordinating agent reviews and commits.
- Run the smallest relevant checks after integration.
