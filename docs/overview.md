# ORCa — Overview

## What is ORCa?

ORCa (OpenAPI as Remote CLI) is a proof-of-concept implementation that wraps an existing OpenAPI specification as an MCP-compatible stdio server. It exposes all tools and tool sets from the remote service through a single text input, behaving like a command line interface.

ORC (OpenAPI as Remote CLI) is a concept of an LLM-first web protocol alternative to MCP. While MCP exposes individual tools that an LLM must discover and invoke, ORC presents a unified CLI-like interface backed by the remote service's OpenAPI spec. The entire CLI behavior is generated from and verified against that spec.

## Why ORCa?

| Aspect | ORC | MCP |
| --- | --- | --- |
| Interface | Simple, familiar CLI-like interface usable by humans and LLMs | Designed for LLMs only |
| Context consumption | `--help` flag loads context only when needed, reducing token usage | All tools loaded into context at once, consuming precious tokens |
| Integration | Auto-generated from OpenAPI specs — no custom package per service | Requires building MCP servers for each integration |

ORCa is especially useful for locally-hosted LLMs where automated setup and context efficiency are critical.

## Architecture

ORCa is composed of three main layers:

1. **MCP Server Layer** (`src/mcp/server.ts`): Bootstraps an `OrcClient` from the `ORCA_SPEC_ENDPOINT` environment variable on startup. Registers a single `command_line` tool that delegates to the client. The server aborts if the client cannot connect or fetch a valid spec.

2. **ORC Client Layer** (`src/orc/`): The `OrcClient` class fetches the OpenAPI spec, parses it, builds a command map (`ResourceDef → FuncDef → ParamDef`), and resolves parsed commands to concrete HTTP requests. It also provides `help`, `helpResource`, and `helpFunction` methods for dynamic help text generation.

3. **Tool Layer** (`src/mcp/tools/`): A quote-aware argument parser (`parseArguments`) that splits input on whitespace while preserving quoted strings and escaped characters.

## Key Features

- **Single string input**: All command arguments are accepted through one string; the system parses and routes to the appropriate OpenAPI operation.
- **Auto-generated help**: `--help` text is generated from resource, function, and input descriptions in the OpenAPI spec. Supports three levels: service, resource, and function.
- **Remote service integration**: The `OrcClient` connects to the remote service on startup, fetching and caching the OpenAPI spec. All commands are executed against the live API.
- **OpenAPI-first**: The spec defines exactly how the remote service accepts requests. No behavior is assumed beyond what is documented.
- **MCP-compatible**: Built on `@modelcontextprotocol/typescript-sdk`, allowing any MCP client (Claude Code, Hermes, etc.) to use ORCa without codebase modifications.

## Current State

This is a proof-of-concept implementation. The core protocol and routing are functional, with the ORCClient fully integrated into the MCP server lifecycle. Help text generation works at all three levels (service, resource, function).
