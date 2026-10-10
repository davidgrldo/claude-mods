# Changelog

## 0.3.3
- Sessions idle for more than 30 minutes are hidden. A session that went idle more recently (most likely waiting for you) stays, marked `NEEDS YOU`.

## 0.3.2
- Finished subagents are collapsed by default; opening them shows the latest eight.

## 0.3.1
- Side panel split into two sections, Sessions and Subagents, each with an overview progress bar.
- Every session card has a progress bar: a sweep while it works, a draining bar while it is idle.

## 0.3.0
- Sessions panel: every live Claude Code session on the machine, with status and last activity; the band shows the count.

## 0.2.0
- Responsive card: stacks when narrow; subagents listed inline when the panel has no room.
- `/monitor` toggles the band and the agents panel together (`on` / `off` to force).
- Panel opens at session start.
- Realtime: usage re-read every 5 s mid-turn and every 15 s idle.

## 0.1.0
- Model, effort, context, 5H/7D limits, cost, task bar (`mcp__live-status__task`) and the agents panel.
