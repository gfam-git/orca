# Welcome to _ORCa_!

## What is _ORCa_?

The  "ORC" in _ORCa_ stands for **OpenAPI as Remote CLI**, which is meant to serve as an alternative to [_MCP_](https://modelcontextprotocol.io/docs/2026-07-28/getting-started/intro). Namely, _ORC_ is a concept of an LLM-first web protocol like _MCP_, except that it exposes all tools and tool sets via a single text input like a command line. The entire CLI behavior on the remote side is powered by, and verified by, an existing [_OpenAPI_](https://www.openapis.org/what-is-openapi) spec for said service.

This project, _ORCa_, is a proof-of-concept implementation that utilizes the already existing, official, [`@modelcontextprotocol/server`](https://github.com/modelcontextprotocol/typescript-sdk) _MCP_ server SDK. This is for a few reasons:

1. Any _MCP_ client (Claude Code, Hermes, etc.) can try _ORCa_ with no modifications to their codebase.
2. It's quicker to develop on top of an existing protocol, at least for a POC, than it is creating one from scratch.

### Features (Existing and Planned)

- Interface with any web service exposing an OpenAPI spec.
- Single string input for accepting all the command arguments.
- Automatically parse input and interact with attached service according to OpenAPI spec.
- Automatically generate `--help` text based on resource, functions, and input descriptions in the OpenAPI spec.
- `ORCA_SPEC_ENDPOINT` environment variable validation on server startup — the server refuses to start if unset, empty, or not a valid URL.
- `ORCA_SERVICE_BASE_URL` optional environment variable for separating the spec endpoint from the live API endpoint — when unset, the server automatically extracts a base URL from the OpenAPI spec's `servers` property (top-level or per-path). If no servers are defined, it falls back to the spec endpoint.
- Automatic backend detection from OpenAPI spec's `servers` property — extracts the first valid top-level server URL, or falls back to per-path servers if the top-level is missing or invalid.
- Quote-aware CLI argument parser that splits on whitespace while preserving quoted strings and escaped characters.
- `formatArguments()` placeholder logic that pretty-prints parsed arguments as an indexed, single-quoted list.
- Authentication configuration via environment variables (`ORCA_AUTH_METHOD`, `ORCA_AUTH_BEARER_TOKEN`, `ORCA_AUTH_BASIC_*`, `ORCA_AUTH_APIKEY_*`) or OpenAPI spec security schemes.
- `ORCA_EXCLUDE_TAGS` — Optional comma-delimited tag list to exclude operations from the command map.

### Why?

Pros and Cons of _MCP_ vs. _ORC_.

| ORC | MCP |
| --- | --- |
| Simple, familiar interface that can theoretically be used by humans and not just LLMs. | Can only be practically used by LLMs. |
| Forcing use of `--help` flag in tool calls reduces context consumption, and ensures that agents get only the context they need when they need it. | Exposed tools are added to the context all at once, making it easy for agents to know how to use all tools immediately, but consume precious context. |
| OpenAPI specs define exactly how the web service accepts requests, so a CLI can be automatically generated without creating a custom package for each integration. | This can theoretically be done with _MCP_ servers as well, but would be more difficult from a development standpoint. |

_ORC_ should be especially attractive to people utilizing locally-hosted LLMs, as automated setup and context efficiency is paramount in these use-cases.

## Quick Start

The fastest way to try ORCa:

```bash
export ORCA_SPEC_ENDPOINT=https://example.com/openapi.json
npx -y @adam-gfam/orca
```

Then use the `command_line` tool from any MCP client with a single string:

```
command_line(input="--help")
```

This lists all available resources. Use `<resource> --help` to explore further.

## Getting Started

Simply add the server to any _MCP_ client. This will depend on the client being used, so consult those docs.\\
This can be done via the `stdio` transport.\\

The `ORCA_SPEC_ENDPOINT` environment variable is required, and must be set to the URL of the remote service endpoint serving the OpenAPI spec.

### Command-Line Tool

Once configured, the server exposes a single `command_line` tool that accepts a string input and parses it into arguments:

- The input string is split on whitespace (spaces, tabs, newlines).
- Content wrapped in matching single (`'`) or double (`"`) quotes is preserved as a single argument, including any internal whitespace.
- Escaped characters (`\"` and `\'`) are handled inside quoted strings.
- The parsed arguments are returned as a pretty-printed, indexed list with each argument wrapped in single quotes.

#### Example Input

```
hello 'world foo' bar
```

#### Example Output

```
Arguments (3):
  [ 0] 'hello'
  [ 1] 'world foo'
  [ 2] 'bar'
```

### Environment Variables

ORCa uses environment variables for configuration:

| Variable | Required | Description |
| --- | --- | --- |
| `ORCA_SPEC_ENDPOINT` | Yes | URL of the remote service endpoint serving the OpenAPI spec |
| `ORCA_SERVICE_BASE_URL` | No | URL for live API calls (defaults to spec endpoint or auto-detected) |
| `ORCA_AUTH_METHOD` | No | Auth method override: `none`, `bearer`, `basic`, or `apikey` |
| `ORCA_AUTH_BEARER_TOKEN` | Conditional | Bearer token value (required when `ORCA_AUTH_METHOD=bearer`) |
| `ORCA_AUTH_BASIC_USERNAME` | Conditional | Basic auth username |
| `ORCA_AUTH_BASIC_PASSWORD` | Conditional | Basic auth password |
| `ORCA_AUTH_APIKEY_NAME` | Conditional | API key parameter name |
| `ORCA_AUTH_APIKEY_VALUE` | Conditional | API key value |
| `ORCA_AUTH_APIKEY_IN` | No | API key injection location: `header` (default), `query`, or `cookie` |
| `ORCA_EXCLUDE_TAGS` | No | Comma-delimited tag names to exclude from the command map (e.g., `act,default`) |

The `ORCA_SPEC_ENDPOINT` environment variable must be set before the server starts. The server will refuse to start with exit code 1 if:

1. `ORCA_SPEC_ENDPOINT` is not set.
2. `ORCA_SPEC_ENDPOINT` is empty.
3. `ORCA_SPEC_ENDPOINT` is not a valid URL.

### Authentication

ORCa supports four auth methods: `none`, `bearer`, `basic`, and `apikey`. You can either:

1. **Override via environment variables** — set `ORCA_AUTH_METHOD` and the corresponding credential variables. This takes precedence over any auth inferred from the OpenAPI spec.
2. **Infer from the spec** — if `ORCA_AUTH_METHOD` is unset, ORCa examines the first `securitySchemes` entry in the OpenAPI spec.

See [docs/reference/environment-variables.md](docs/reference/environment-variables.md) for the complete reference.

### Example Configs

Hermes Agent (Dashboard)
------

Log into Hermes.

Navigate to **MCP** and click **Add Server**.

Set the following fields:
- **Name** - Any name you want. For example `web-browser-orca` for a web browser service.
- **Transport** - `stdio`
- **Command** - `npx`
- **Args** - `-y @adam-gfam/orca`
- **Environment**
  ```
  ORCA_SPEC_ENDPOINT=https://remote.service.example.tld/api
  ```
---

## Full Documentation

All technical documentation is in the [docs/](docs/) directory.

- [docs/INDEX.md](docs/INDEX.md) — Full documentation index
- [docs/overview.md](docs/overview.md) — High-level overview of ORCa
- [docs/protocol/](docs/protocol/) — Protocol specification, architecture, auth, tools, usage guide
- [docs/reference/](docs/reference/) — Getting started, dependencies, environment variables

## Dependencies

ORCa uses a curated stack of lightweight, type-safe packages:

### Runtime Dependencies

| Package | Version | Purpose | Justification |
| --- | --- | --- | --- |
| `undici` | `^8.10.2` | HTTP client for making web requests to remote OpenAPI spec endpoints and API calls | Zero dependencies, fastest benchmarks (up to 3.4x faster than alternatives), official Node.js foundation project, advanced connection pooling |
| `openapi-fetch` | `^0.17.0` | Typed fetch client for API operations | 6 kB bundle, 300k ops/s, zero manual typing, types flow directly from OpenAPI schema |
| `openapi-typescript` | `^7.13.0` | Generates TypeScript types from OpenAPI 3.x/3.1 schemas | Officially maintained, generates `.d.ts` files from remote specs, essential companion to `openapi-fetch` for end-to-end type safety |

### Development Dependencies

| Package | Version | Purpose | Justification |
| --- | --- | --- | --- |
| `typescript` | `^5.9.3` | TypeScript compiler | Required for the MCP TypeScript SDK; pinned to `^5.9.3` for peer dependency compatibility |
| `ts-node` | `^10.9.2` | TypeScript execution engine for Node.js | Enables running TypeScript source directly during development |
| `@types/node` | `^22.20.2` | Node.js TypeScript type definitions | Provides type safety for Node.js APIs |

### Alternative Packages Considered

- **axios** — Feature-rich HTTP client with interceptors, but heavier (32 kB) and slower in benchmarks. Consider if request/response transformers are needed.
- **got** — HTTP/2 support and RFC 7234 caching, but native ESM only. Authors recommend `ky` for simpler needs.
- **ky** — Lightweight fetch-based client by the same authors as `got`. Works in browser and Node.js.
- **openapi-typescript-codegen** — Generates actual TypeScript client code, but much heavier (367 kB) and 3x slower.
- **openapi-typescript-fetch** — Smallest OpenAPI client at 3 kB. Consider if minimal bundle size is the top priority.

## Developing and Contributing

All contributions welcome.\\
In general, the following guidelines should be adhered to:

- New features should be developed in a new branch off of `origin/main`.
- This `README` and the accompanying `AGENTS.md` files should be updated when needed with high-level project info and contribution guidelines/instructions.
- All enhancements or bug fixes should include automated tests.
- The appropriate sub-directories, documentation files, and `INDEX.md` files should be maintained with every code change.
- When work is complete, create a pull request to merge the branch into `main`.
- **Branch naming**: Name branches after the feature (e.g., `feat/auth-env-vars`), not kanban task IDs.

### Project Structure

Keep this up-to-date as the project evolves.\\

```
|-- README.md       // Project overview for non-agents (what is ORCa, why, getting started)
|-- AGENTS.md       // Project guide for AI agents (protocol, dev workflow, contributing)
|-- src/            // Source code for the ORCa implementation
|   |-- index.ts    // Entry point — exports and server bootstrap
|   |-- mcp/        // MCP server implementation
|   |   |-- validation.ts  // ORCA_SPEC_ENDPOINT validation
|   |   |-- server.ts     // MCP server setup and tool registration
|   |   |-- tools/        // Tool implementations
|   |       |-- index.ts      // Tool exports
|   |       |-- input-parser.ts  // Quote-aware CLI argument parser
|   |       |-- format-args.ts // Placeholder logic for argument output
|   |-- orc/          // ORC client implementation
|       |-- auth.ts       // Authentication env var parsing and header injection
|       |-- client.ts     // ORCClient — OpenAPI spec fetch, command routing, exec
|       |-- index.ts      // Barrel export for orc module
|       |-- types.ts      // Type definitions (CommandMap, ParamDef, AuthConfig, etc.)
|-- tests/          // Test suite
|   |-- mcp/        // MCP tool tests
|       |-- input-tool-test.ts  // Tests for parseArguments and formatArguments
|-- docs/           // Top-level directory for all technical documentation
   |-- INDEX.md    // Index of all docs and sub-directories
   |-- overview.md // High-level overview of ORCa
   |-- protocol/   // Protocol specification and architecture docs
   |-- reference/  // Reference materials (getting started, deps, env vars)
```

### For AI Agents

Read `AGENTS.md` for detailed guidance on how agents should interact with this project, including protocol understanding, development workflow, and common tasks.
