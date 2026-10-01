# ORCa — Dependencies

## Runtime Dependencies

| Package | Version | Purpose |
| --- | --- | --- |
| `undici` | `^8.10.2` | HTTP client for web requests to remote OpenAPI endpoints and API calls. Zero dependencies, fastest benchmarks (up to 3.4x faster than alternatives), official Node.js foundation project. |
| `openapi-fetch` | `^0.17.0` | Typed fetch client for API operations. 6 kB bundle, types flow directly from OpenAPI schema. |
| `openapi-typescript` | `^7.13.0` | Generates TypeScript types from OpenAPI 3.x/3.1 schemas. Generates `.d.ts` files from remote specs for end-to-end type safety. |

## Development Dependencies

| Package | Version | Purpose |
| --- | --- | --- |
| `typescript` | `^5.9.3` | TypeScript compiler. Pinned for peer dependency compatibility with the MCP SDK. |
| `ts-node` | `^10.9.2` | TypeScript execution engine for Node.js. Enables running TypeScript source directly during development. |
| `@types/node` | `^22.20.2` | Node.js TypeScript type definitions. |

## Base Dependencies

| Package | Version | Purpose |
| --- | --- | --- |
| `@modelcontextprotocol/server` | `^2.0.0` | Official MCP server SDK. Foundation of the ORCa implementation, enabling MCP client compatibility. |

## Alternative Packages Considered

- **axios** — Feature-rich HTTP client with interceptors, but heavier (32 kB) and slower in benchmarks.
- **got** — HTTP/2 support and RFC 7234 caching, but native ESM only.
- **ky** — Lightweight fetch-based client by the same authors as `got`. Works in browser and Node.js.
- **openapi-typescript-codegen** — Generates TypeScript client code, but much heavier (367 kB) and 3x slower.
- **openapi-typescript-fetch** — Smallest OpenAPI client at 3 kB. Consider if minimal bundle size is the top priority.

See [README.md](../../README.md) for the full comparison table with benchmarks and justifications.
