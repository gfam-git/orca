# AGENTS.md — ORCa Project Guide for AI Agents

## Overview

ORCa (OpenAPI as Remote CLI) is a proof-of-concept implementation that wraps an existing OpenAPI spec as an MCP-compatible stdio server, exposing all tools and tool sets through a single text input like a command line. It leverages the [`@modelcontextprotocol/typescript-sdk`](https://github.com/modelcontextprotocol/typescript-sdk) MCP server SDK as its foundation.

## How Agents Should Interact With This Project

### 1. Understanding the Protocol

- ORC is an **LLM-first web protocol** alternative to MCP. Instead of exposing individual tools, it presents a single CLI-like interface backed by an OpenAPI spec.
- The `ORCA_SPEC_ENDPOINT` environment variable must be set to the URL of the remote service serving the OpenAPI spec. The server validates this on startup and refuses to start if unset, empty, or not a valid URL.
- Agents should treat ORCa as a **transitional bridge**: any MCP client can use it without codebase modifications.

### 2. Working With the Codebase

- **Entry point**: The project is an npm package (`@adam-gfam/orca`). The main entry point is in `src/`.
- **Framework**: Built on `@modelcontextprotocol/typescript-sdk`. Familiarity with MCP server SDK patterns is essential.
- **Language**: TypeScript (via the MCP TypeScript SDK).
- **ORCA_SPEC_ENDPOINT**: This environment variable is populated by end-users running the server, not by developers or agents during development.

### 3. Development Workflow

- Create new feature branches from `origin/main`.
- All enhancements or bug fixes **must include automated tests**.
- Update `README.md` and this `AGENTS.md` with high-level changes.
- Maintain `docs/` and its `INDEX.md` with every code change.
- When work on a feature or fix is complete, create a pull request to merge the branch into `main`.
- **Branch naming**: Branches should be named after the feature being implemented, not the kanban task ID (e.g., `feat/argument-parser` instead of `wt/t_458a6dc1`).
- **Existing branches**: Existing branches can be reused so long as they are updated via `origin/main` prior to starting any work.

### 4. Project Structure

```
|-- README.md       // Project details for non-agents (what is ORCa, why, getting started)
|-- AGENTS.md       // You are here — project details for AI agents
|-- src/            // Source code for the ORCa implementation
|   |-- index.ts    // Entry point — exports and server bootstrap
|   |-- mcp/        // MCP server implementation
|   |   |-- validation.ts  // ORCA_SPEC_ENDPOINT validation
|   |   |-- server.ts     // MCP server setup and tool registration
|   |   |-- tools/        // Tool implementations
|   |       |-- index.ts      // Tool exports
|   |       |-- input-parser.ts  // Quote-aware CLI argument parser
|   |       |-- format-args.ts // Placeholder logic for argument output
|-- tests/          // Test suite
|   |-- mcp/        // MCP tool tests
|       |-- input-tool-test.ts  // Tests for parseArguments and formatArguments
|-- docs/           // Top-level directory for all technical documentation
   |-- INDEX.md    // Index of all docs and sub-directories
   |-- .../        // Sub-directories and corresponding INDEX.md files as needed
```

### 5. Key Concepts to Keep in Mind

- **Single string input**: All command arguments are accepted through one string. The agent must parse this input and route to the appropriate OpenAPI operation.
- **Quote-aware argument parsing**: The `parseArguments()` function splits on whitespace while preserving quoted strings (single `'` or double `"`) and escaped characters (`\"` and `\'`). Quotes are preserved in the output.
- **Placeholder logic**: The `formatArguments()` function pretty-prints parsed arguments as a multi-line string with indexed entries wrapped in single quotes. Use this for readable output formatting.
- **Auto-generated `--help`**: Use the OpenAPI spec to generate help text for resources, functions, and inputs. Agents should leverage this to reduce context consumption.
- **OpenAPI-first**: The spec defines exactly how the remote service accepts requests. Never assume behavior not documented in the spec.
- **Context efficiency**: For locally-hosted LLMs, context consumption is critical. Use `--help` flags strategically to load context only when needed.

### 6. Testing

- Run existing tests before making changes to ensure nothing breaks.
- Write new tests for every feature or bug fix.
- Tests should cover input parsing, OpenAPI spec routing, and help text generation.

### 7. Common Tasks for Agents

- **Adding a new OpenAPI-backed service**: Update `ORCA_SPEC_ENDPOINT` and verify the spec is accessible.
- **Modifying input parsing**: Ensure the single-string parser correctly routes to OpenAPI operations.
- **Updating help text**: Regenerate from the OpenAPI spec when the remote service changes.
- **Bug fixes**: Reproduce with tests, fix, and verify.

### 8. Dependencies

The project uses a curated stack of lightweight, type-safe packages:

**Runtime Dependencies:**

- `undici` (`^8.10.2`) — HTTP client for making web requests to remote OpenAPI spec endpoints and API calls. Zero dependencies, fastest benchmarks, official Node.js foundation project.
- `openapi-fetch` (`^0.17.0`) — Typed fetch client for API operations. 6 kB bundle, zero manual typing, types flow directly from OpenAPI schema.
- `openapi-typescript` (`^7.13.0`) — Generates TypeScript types from OpenAPI 3.x/3.1 schemas. Generates `.d.ts` files from remote specs.

**Development Dependencies:**

- `typescript` (`^5.9.3`) — TypeScript compiler. Pinned for peer dependency compatibility with the MCP SDK.
- `ts-node` (`^10.9.2`) — TypeScript execution engine for Node.js. Enables running TypeScript source directly during development.
- `@types/node` (`^22.20.2`) — Node.js TypeScript type definitions.

**Alternatives Considered:** `axios` (heavier, slower), `got`/`ky` (ESM-only, lighter fetch wrapper), `openapi-typescript-codegen` (generates code, much heavier), `openapi-typescript-fetch` (3 kB, smallest). See `README.md` for full comparison.

## Contributing

All contributions are welcome. Follow the guidelines in `README.md` and keep this file current as the project evolves.
