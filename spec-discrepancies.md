# Spec Discrepancy Report: OpenAPI vs MCP Server

This document compares the **OpenAPI specification** (fetched from `http://camofox-browser:9377/openapi.json`, v1.15.0) against the **MCP server API reference** (queried from the `orca-camofox-test` CLI, saved to `mcp-server-spec.md`).

---

## 1. Resources Present in OpenAPI Spec but MISSING from MCP Server

The MCP server omits or collapses many OpenAPI endpoints into the generic `act` legacy resource. The following OpenAPI endpoints have no dedicated MCP resource:

### Navigation endpoints (missing)
| OpenAPI Path | MCP Resource |
|---|---|
| `POST /tabs/{tabId}/navigate` | Only partially covered by `navigate` (OpenClaw format, different signature) |
| `POST /tabs/{tabId}/back` | **Missing entirely** |
| `POST /tabs/{tabId}/forward` | **Missing entirely** |
| `POST /tabs/{tabId}/refresh` | **Missing entirely** |
| `POST /tabs/{tabId}/viewport` | **Missing entirely** |

### Interaction endpoints (missing)
| OpenAPI Path | MCP Resource |
|---|---|
| `POST /tabs/{tabId}/wait` | **Missing entirely** |
| `POST /tabs/{tabId}/upload` | **Missing entirely** |
| `POST /tabs/{tabId}/select` | **Missing entirely** |
| `POST /tabs/{tabId}/press` | **Missing entirely** |
| `POST /tabs/{tabId}/scroll` | **Missing entirely** |
| `POST /tabs/{tabId}/viewport` | **Missing entirely** |

### Content endpoints (missing)
| OpenAPI Path | MCP Resource |
|---|---|
| `GET /tabs/{tabId}/links` | **Missing entirely** |
| `GET /tabs/{tabId}/downloads` | **Missing entirely** |
| `GET /tabs/{tabId}/images` | **Missing entirely** |
| `GET /tabs/{tabId}/stats` | **Missing entirely** |

### Sessions endpoints (missing)
| OpenAPI Path | MCP Resource |
|---|---|
| `GET /sessions/{userId}/traces` | **Missing entirely** |
| `GET /sessions/{userId}/traces/{filename}` | **Missing entirely** |
| `DELETE /sessions/{userId}/traces/{filename}` | **Missing entirely** |
| `DELETE /sessions/{userId}` | **Missing entirely** |

### Tabs management (missing)
| OpenAPI Path | MCP Resource |
|---|---|
| `GET /tabs` | **Missing entirely** (list open tabs) |
| `DELETE /tabs/{tabId}` | **Missing entirely** (close single tab) |
| `DELETE /tabs/group/{listItemId}` | **Missing entirely** (close group) |

### Interaction: evaluate (missing)
| OpenAPI Path | MCP Resource |
|---|---|
| `POST /tabs/{tabId}/evaluate` | **Missing entirely** |

### Interaction: extract (missing)
| OpenAPI Path | MCP Resource |
|---|---|
| `POST /tabs/{tabId}/extract` | **Missing entirely** |

**Total missing from MCP server: 20 endpoints**

---

## 2. Resources Present in MCP Server but MISSING from OpenAPI Spec

The MCP server exposes these as standalone resources, but they are either **deprecated legacy aliases** in the OpenAPI spec or represent **no new functionality**:

| MCP Resource | OpenAPI Equivalent |
|---|---|
| `navigate` (post) | Duplicate of `POST /navigate` (deprecated, OpenClaw format) |
| `snapshot` (get) | Duplicate of `GET /snapshot` (deprecated, OpenClaw format) |
| `act` (post) | Duplicate of `POST /act` (deprecated, OpenClaw format) |

These three resources do NOT correspond to new capabilities — they are the legacy OpenClaw-format endpoints that are already documented in the OpenAPI spec under the "Legacy" tag and marked `"deprecated": true`. The MCP server simply exposes them as separate top-level resources.

**Net new functionality from MCP server not in OpenAPI: 0**

---

## 3. Parameter Discrepancies (Endpoints that exist in both but differ)

### `POST /tabs/{tabId}/navigate` (OpenAPI) vs `navigate` resource (MCP)

| Field | OpenAPI `POST /tabs/{tabId}/navigate` | MCP `navigate` resource |
|---|---|---|
| `userId` | present in request body | present |
| `url` | present in request body | present |
| `macro` | **present** (search macro like `@google_search`) | **MISSING** |
| `query` | **present** (search query for macro) | **MISSING** |
| `sessionKey` | present in request body | **MISSING** |
| `listItemId` | present in request body | **MISSING** |

The MCP `navigate` resource only exposes the legacy `targetId` + `url` signature, stripping all modern parameters (`macro`, `query`, `sessionKey`).

### `GET /tabs/{tabId}/snapshot` (OpenAPI) vs `snapshot` resource (MCP)

| Field | OpenAPI `GET /tabs/{tabId}/snapshot` | MCP `snapshot` resource |
|---|---|---|
| `tabId` | path parameter | **MISSING** (uses `targetId` query param instead) |
| `userId` | query parameter (required) | present |
| `format` | query parameter (enum: text/json, default text) | present |
| `offset` | query parameter (integer) | present |
| `includeScreenshot` | query parameter (enum: true/false) | present |

The MCP `snapshot` resource uses the legacy `targetId` query param instead of `tabId` as a path parameter. Same data, different transport.

### `POST /act` (OpenAPI) — MCP `act` resource

The MCP `act` resource mirrors the OpenAPI `act` parameters exactly (userId, kind, targetId, ref, selector, text, key, direction, url). No discrepancy here, but note that `act` is a **catch-all legacy endpoint** that routes to click/type/scroll/press/etc. based on `kind`. The OpenAPI spec provides **dedicated endpoints** for each action (click, type, scroll, press, select, wait, viewport, upload, evaluate, extract, back, forward, refresh), while the MCP server only exposes the monolithic `act` legacy endpoint plus the `snapshot` and `navigate` legacy aliases.

---

## 4. Summary of Discrepancies

### What the MCP server is missing (20 endpoints):
1. `GET /tabs` — list open tabs
2. `POST /tabs/{tabId}/wait` — wait for selector
3. `POST /tabs/{tabId}/click` — click element
4. `POST /tabs/{tabId}/upload` — attach file
5. `POST /tabs/{tabId}/type` — type text
6. `POST /tabs/{tabId}/select` — select form option
7. `POST /tabs/{tabId}/press` — press key
8. `POST /tabs/{tabId}/scroll` — scroll page
9. `POST /tabs/{tabId}/viewport` — resize viewport
10. `POST /tabs/{tabId}/back` — go back
11. `POST /tabs/{tabId}/forward` — go forward
12. `POST /tabs/{tabId}/refresh` — refresh page
13. `GET /tabs/{tabId}/links` — extract links
14. `GET /tabs/{tabId}/downloads` — list downloads
15. `GET /tabs/{tabId}/images` — extract images
16. `GET /tabs/{tabId}/screenshot` — take screenshot
17. `GET /tabs/{tabId}/stats` — tab statistics
18. `POST /tabs/{tabId}/evaluate` — evaluate JavaScript
19. `POST /tabs/{tabId}/extract` — structured data extraction
20. `DELETE /tabs/{tabId}` — close tab
21. `DELETE /tabs/group/{listItemId}` — close group
22. `GET /sessions/{userId}/traces` — list traces
23. `GET /sessions/{userId}/traces/{filename}` — download trace
24. `DELETE /sessions/{userId}/traces/{filename}` — delete trace
25. `DELETE /sessions/{userId}` — destroy session

### What the MCP server adds (0 new):
- All 3 MCP-only resources (`navigate`, `snapshot`, `act`) are deprecated OpenClaw-format aliases already present in the OpenAPI spec.

### Parameter gaps in MCP `navigate` resource:
- Missing `macro`, `query`, `sessionKey`, `listItemId` — all present in OpenAPI `POST /tabs/{tabId}/navigate`.

### Design difference:
- The OpenAPI spec exposes **28 distinct endpoints** across 8 tag groups (System, Tabs, Navigation, Interaction, Content, Sessions, Browser, Legacy).
- The MCP server exposes **11 resources** but collapses many OpenAPI endpoints into the monolithic `act` legacy endpoint, or omits them entirely. The MCP server does NOT provide individual tools for click, type, scroll, press, select, upload, wait, viewport, back, forward, refresh, links, downloads, images, screenshot, stats, evaluate, extract, or session management.
