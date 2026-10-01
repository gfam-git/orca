# ORCa Camofox-Browser MCP Server — Full API Reference

> Queried via `orca-camofox-test` CLI. All 11 resources, their functions, and parameters documented below.

## Resource: sessions
- **Function:** `cookies` — Import cookies into a user session
  - `--userId` string (required) — Session owner identifier.
  - `--cookies` array (required)

## Resource: health
- **Function:** `get` — Health check
  - No parameters

## Resource: metrics
- **Function:** `get` — Prometheus metrics
  - No parameters

## Resource: pressure
- **Function:** `cleanup` — Proactive memory-pressure cleanup
  - `--dryRun` boolean [boolean] (optional) — When true, returns candidates without closing them.
  - `--minIdleMs` number (optional) — Minimum idle time (ms) before a tab is eligible.
  - `--maxTabsToClose` number (optional) — Maximum tabs to close per invocation.
  - `--minTabsPerSession` number (optional) — Preserve at least this many tabs per session.
  - `--closeEmptySessions` boolean [boolean] (optional) — Close sessions left with zero tabs after cleanup.

## Resource: tabs
- **Function:** `post` — Create a new tab
  - `--userId` string (required) — Session owner.
  - `--sessionKey` string (required) — Tab group identifier.
  - `--listItemId` string (optional) — Legacy alias for sessionKey.
  - `--url` string (optional) — Optional initial URL.
  - `--trace` boolean [boolean] (optional) — Enable Playwright tracing for this session (screenshots, DOM snapshots, network). Must be set on first tab creation; cannot be added to an existing session.

## Resource: default
- **Function:** `get` — Server status
  - No parameters

## Resource: start
- **Function:** `post` — Start browser
  - No parameters

## Resource: stop
- **Function:** `post` — Stop browser
  - No parameters

## Resource: navigate
- **Function:** `post` — Navigate (OpenClaw format)
  - `--userId` string (required)
  - `--targetId` string (optional)
  - `--url` string (required)

## Resource: snapshot
- **Function:** `get` — Snapshot (OpenClaw format)
  - `--targetId` string (required)
  - `--userId` string (required)
  - `--format` string (optional)
  - `--offset` integer (optional)
  - `--includeScreenshot` string (optional)

## Resource: act
- **Function:** `post` — Combined action (OpenClaw format)
  - `--userId` string (required)
  - `--kind` string (required) — Action kind: click, type, scroll, press, key, select_option, drag, hover, screenshot, wait, back, forward.
  - `--targetId` string (optional)
  - `--ref` string (optional)
  - `--selector` string (optional)
  - `--text` string (optional)
  - `--key` string (optional)
  - `--direction` string (optional)
  - `--url` string (optional)
