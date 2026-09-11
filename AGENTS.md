# AGENTS.md — ORCa Project Guide for AI Agents

## Overview

ORCa (OpenAPI as Remote CLI) is a proof-of-concept implementation that wraps an existing OpenAPI spec as an MCP-compatible stdio server, exposing all tools and tool sets through a single text input like a command line. It leverages the [`@modelcontextprotocol/typescript-sdk`](https://github.com/modelcontextprotocol/typescript-sdk) MCP server SDK as its foundation.

## How Agents Should Interact With This Project

### 1. Understanding the Protocol

- ORC is an **LLM-first web protocol** alternative to MCP. Instead of exposing individual tools, it presents a single CLI-like interface backed by an OpenAPI spec.
- The `ORCA_SPEC_ENDPOINT` environment variable must be set to the URL of the remote service serving the OpenAPI spec.
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

### 4. Project Structure

```
-- README.md       // Project details for non-agents (what is ORCa, why, getting started)
-- AGENTS.md       // You are here — project details for AI agents
-- src/            // Source code for the ORCa implementation
-- docs/           // Top-level directory for all technical documentation
   |-- INDEX.md    // Index of all docs and sub-directories
   |-- .../        // Sub-directories and corresponding INDEX.md files as needed
```

### 5. Key Concepts to Keep in Mind

- **Single string input**: All command arguments are accepted through one string. The agent must parse this input and route to the appropriate OpenAPI operation.
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

## Contributing

All contributions are welcome. Follow the guidelines in `README.md` and keep this file current as the project evolves.
