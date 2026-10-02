# AGENTS.md — ORCa Project Guide for AI Agents

## Overview

ORCa (OpenAPI as Remote CLI) is a proof-of-concept implementation that wraps an existing OpenAPI spec as an MCP-compatible stdio server, exposing all tools and tool sets through a single text input like a command line. It leverages the [`@modelcontextprotocol/typescript-sdk`](https://github.com/modelcontextprotocol/typescript-sdk) MCP server SDK as its foundation.

## How Agents Should Interact With This Project

**IMPORTANT!** Prior to performing any work on this codebase, please reade the project [README.md](README.md) and [CONTRIBUTING.md](CONTRIBUTING.md). These guidelines **_must_** be followed when contributing to the project.

At a high-level:
1. **Clone** the repo if not already done, checkout and pull the `main` branch, and install project dependencies.
2. Checkout a new, named branch named following the convention in the guidelines.
3. Perform all necessary development work, documentation updates, and automated test updates.
4. Execute automated tests and perform regression testing.
5. Build the project and fix any compilation errors. Validate the build runs correctly.
6. Create a PR for merging your branch into `main`.

