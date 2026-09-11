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

### Why?

Pros and Cons of _MCP_ vs. _ORC_.

| ORC | MCP |
| --- | --- |
| Simple, familiar interface that can theoretically be used by humans and not just LLMs. | Can only be practically used by LLMs. |
| Forcing use of `--help` flag in tool calls reduces context consumption, and ensures that agents get only the context they need when they need it. | Exposed tools are added to the context all at once, making it easy for agents to know how to use all tools immediately, but consume precious context. |
| OpenAPI specs define exactly how the web service accepts requests, so a CLI can be automatically generated without creating a custom package for each integration. | This can theoretically be done with _MCP_ servers as well, but would be more difficult from a development standpoint. |

_ORC_ should be especially attractive to people utiliing locally-hosted LLMs, as automated setup and context efficiency is paramount in these use-cases.

## Getting Started

Simply add the server to any _MCP_ client. This will depend on the client being used, so consult those docs.\
This can be done via the `stdio` transport.\
The `ORCA_SPEC_ENDPOINT` environment variable is required, and must be set to the URL of the remote service endpoint serving the OpenAPI spec.

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

## Developing and Contributing

All contributions welcome.\
In general, the following guidlines should be adhered to:

- New features should be developed in a new branch off of `origin/main`.
- This `README` and the accompanying `AGENTS.md` files should be updated when needed with high-level project info and contribution guidelines/instructions.
- All enhancements or bug fixes should include automated tests.
- The appropriate sub-directories, documentation files, and `INDEX.md` files should be maintained with every code change.

### Project Structure

Keep this up-to-date as the project evolves.\
No need to repeate the project files and directories verbatim, but outline the overall shape an purpose of the primary directories.

```
|-- README.md       // Contains project details for non-agents.
|-- AGENTS.md       // Contains project details for agents.
|-- src/
|-- docs/           // Top-level directory for all technical documentation.
|   |-- INDEX.md    // Index of all docs and sub-directories in the docs folder. Similar to `index.ts` but for documentation.
|   |-- .../        // Sub-directories and corresponding INDEX.md files created as-needed.
```