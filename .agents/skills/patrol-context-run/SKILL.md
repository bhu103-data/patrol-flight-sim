---
name: patrol-context-run
description: Continue PATROL flight-simulator work from one compact canonical context file. Use when starting, resuming, or handing off a PATROL chat without replaying prior conversations.
---

# PATROL context runner

Use `docs/PATROL_CONTEXT.md` as the single handoff source.

## Start

1. Read `docs/PATROL_CONTEXT.md` first. Do not import old chat transcripts.
2. Inspect only the files named by the selected work item and the current Git diff/status.
3. Recheck live repository facts before editing; timestamps, branches, PRs and CI results in the context file may become stale.
4. Continue one unfinished item. Preserve unrelated changes, maps, flight controls and water-aircraft behavior.

## Finish

Update `docs/PATROL_CONTEXT.md` atomically before handing off:

- move verified work into `Verified state` with evidence;
- keep unverified claims out of that section;
- record the exact next action and blocker;
- keep the file compact by replacing stale status rather than appending a transcript;
- do not copy secrets, tokens, private URLs or long logs into it.

New chats should need only this bootstrap message:

`Use $patrol-context-run. Continue the named work item from docs/PATROL_CONTEXT.md and update that file before stopping.`

If the chat cannot access the repository, attach only `docs/PATROL_CONTEXT.md`; do not paste the whole conversation history.
