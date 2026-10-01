# ORCa — Architecture

## Protocol Design

ORC is an LLM-first web protocol that sits between an MCP client and a remote web service. The flow works as follows:

1. **MCP Client** sends a tool call with a single string argument (the CLI command).
2. **ORCa Server** parses the input string, routing it to the appropriate resource and function defined in the remote OpenAPI spec.
3. **Remote Service** receives the request according to its OpenAPI contract and returns a response.
4. **ORCa Server** formats the response and returns it to the MCP client.

## Internal Architecture

```
+----------------+       +------------------+       +-------------------+
|  MCP Client    | <---> |  ORCa Server     | <---> |  Remote Service   |
|  (Claude,      |  stdio |  (TypeScript)    |  HTTP |  (OpenAPI spec)   |
|  Hermes, etc.) |       |                  |       |                   |
+----------------+       +------------------+       +-------------------+
```

### Components

- **Input Parser**: Takes the single CLI string and extracts resource, function, and input parameters.
- **Spec Loader**: Fetches the OpenAPI spec from the URL set in `ORCA_SPEC_ENDPOINT`.
- **Router**: Matches parsed input against the OpenAPI spec's resources and operations.
- **HTTP Client**: Uses `undici` to make requests to the remote service.
- **Type Generator**: Uses `openapi-typescript` to generate TypeScript types from the spec for type safety.
- **Help Generator**: Produces `--help` text from OpenAPI spec descriptions.

## Transport

ORCa uses the `stdio` transport as defined by the MCP specification. The server is invoked via `npx -y @adam-gfam/orca` and communicates over standard input/output streams.

## Environment Variables

- `ORCA_SPEC_ENDPOINT` — Required. The URL of the remote service endpoint serving the OpenAPI spec. Populated by end-users running the server, not by developers during development.

## Type Safety

The project uses `openapi-fetch` and `openapi-typescript` to ensure end-to-end type safety. Types flow directly from the OpenAPI schema into the TypeScript codebase, eliminating manual typing and ensuring the server's behavior stays aligned with the remote service's contract.
