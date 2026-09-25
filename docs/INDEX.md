# ORCa Documentation Index

This directory contains all technical documentation for the ORCa project.

## Files

- [overview.md](overview.md) — High-level overview of ORCa: what it is, why it exists, and how it fits into the MCP/LLM ecosystem.
- [architecture.md](protocol/architecture.md) — Protocol design, request/response flow, and internal architecture.
- [getting-started.md](reference/getting-started.md) — Setup, configuration, and usage instructions for end users and developers.
- [dependencies.md](reference/dependencies.md) — Full dependency catalog with versions, purposes, and alternatives considered.
- [protocol/](protocol/) — ORC protocol reference documentation (sub-directory)
  - [protocol.md](protocol/protocol.md) — ORC protocol specification: command format, argument parsing, resource/function resolution, help text generation.
  - [auth.md](protocol/auth.md) — Authentication configuration: env vars, auth methods (bearer, basic, apikey), injection rules.
  - [mcp-tools.md](protocol/mcp-tools.md) — MCP tool reference: command_line tool schema, input/output format, help variants, error handling.
  - [usage.md](protocol/usage.md) — General usage guide: workflows, command patterns, parameter handling, debugging tips, client integration.
- [reference/](reference/) — Reference materials (sub-directory)
  - [environment-variables.md](reference/environment-variables.md) — Complete reference for all ORCa environment variables: names, descriptions, defaults, and usage examples.
  - [api-reference.md](reference/api-reference.md) — Complete API reference for ORCa's public types, interfaces, functions, and client.
