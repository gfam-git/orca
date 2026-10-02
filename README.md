# Welcome to _ORCa_!

**⭐ on Github:**  [gfam-git/orca](https://github.com/gfam-git/orca)
**⬇️ from npm:**   [@adam-gfam/orca](https://www.npmjs.com/package/@adam-gfam/orca)

## What is _ORCa_?

The  "ORC" in ORCa_ stands for **OpenAPI as Remote CLI**, which is meant to serve as an alternative to [_MCP_](https://modelcontextprotocol.io/docs/2026-07-28/getting-started/intro). Namely, _ORC_ is a concept of an LLM-first web protocol like _MCP_, except that it exposes all tools and tool sets via a single text input like a command line. The entire CLI behavior on the remote side is powered by, and verified by, an existing [_OpenAPI_](https://www.openapis.org/what-is-openapi) spec for said service.

This project, _ORCa_, is a proof-of-concept implementation that utilizes the already existing, official, [`@modelcontextprotocol/server`](https://github.com/modelcontextprotocol/typescript-sdk) _MCP_ server SDK. This is for a few reasons:

### Features (Existing and Planned)

- Single string input for accepting web requests like CLI commands.
- Builds command map with arguments based on the paths exposed by any arbitrary OpenAPI spec.
- Automatically parse input and interact with attached service according to the OpenAPI spec.
- Automatically generate `--help` text based on resource, functions, and input descriptions in the OpenAPI spec.
- Broad configuration opetions via environment variables.

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

Simply add the server to any _MCP_ client. This will depend on the client being used, so consult those docs.\
This can be done via the `stdio` transport.

The `ORCA_SPEC_ENDPOINT` environment variable is required, and must be set to the URL of the remote service endpoint serving the OpenAPI spec.
For a full list of environment variables, see the docs: [docs/reference/environment-variables.md](docs/reference/environment-variables.md).

### Command-Line Tool

Once configured, the server exposes a single `command_line` tool that accepts a string input and parses it into arguments:

- The input string is split on whitespace (spaces, tabs, newlines).
- Content wrapped in matching single (`'`) or double (`"`) quotes is preserved as a single argument, including any internal whitespace.
- Escaped characters (`\"` and `\'`) are handled inside quoted strings.

For example, the following input:

```
hello 'world foo' bar
```

Would be parsed as the following arguments:

```
Arguments (3):
  [ 0] 'hello'
  [ 1] 'world foo'
  [ 2] 'bar'
```

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

## Developing and Contributing

All contributions welcome.\
Follow the guidlines in [CONTRIBUTING.md](CONTRIBUTING.md) if you wish to collaborate on ORCa.
