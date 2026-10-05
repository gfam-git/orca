# ORC Protocol Specification

## Overview

ORC (OpenAPI as Remote CLI) is an LLM-first web protocol that provides a unified, CLI-like interface to any web service exposing an OpenAPI specification. Instead of exposing individual tools or endpoints, ORC presents a single command-line interface backed entirely by the remote service's OpenAPI spec. The entire CLI behavior — resources, functions, parameters, and help text — is generated from and verified against that spec.

ORCa (the reference implementation) wraps ORC as an MCP-compatible stdio server. Any MCP client (Claude Code, Hermes, etc.) can interact with ORCa using a single `command_line` tool that accepts a string argument. The server parses the string, routes it to the appropriate OpenAPI operation, executes the HTTP request, and returns the response.

## Command Format

The ORC protocol uses a simple, flat command syntax:

```
<resource> <function> [--flag value] [--flag2]
```

### Components

| Component | Description | Example |
| --- | --- | --- |
| `resource` | A logical group derived from the OpenAPI path or tags | `users`, `tabs`, `items` |
| `function` | An operation derived from the HTTP method or path segment | `get`, `post`, `delete`, `create` |
| `--flag` | A parameter flag (two dashes, then the parameter name) | `--id`, `--name`, `--debug` |
| `value` | The value for a flag (omitted for boolean flags) | `123`, `"true"`, `"filter=active"` |

### Examples

```
users get --id 123
tabs create --name "My Tab" --index 0
items delete --id 42 --force true
```

## Argument Parsing

ORC uses a quote-aware argument parser that splits the input string on whitespace while preserving quoted strings and handling escaped characters.

### Parsing Rules

1. **Whitespace splitting**: Arguments are separated by spaces, tabs, newlines, and carriage returns.
2. **Quote preservation**: Content wrapped in matching single (`'`) or double (`"`) quotes is treated as a single argument, including any internal whitespace. Quote characters themselves are stripped from the output.
3. **Escape handling**: Inside quoted strings, escaped characters (`\"` and `\'`) are preserved. The backslash is consumed and the following character is included literally.
4. **Token boundary**: Quotes can only start at the beginning of a token (when `current` is empty).

### Parsing Examples

| Input | Parsed Arguments |
| --- | --- |
| `users get --id 123` | `["users", "get", "--id", "123"]` |
| `tabs create --name 'My Tab'` | `["tabs", "create", "--name", "My Tab"]` |
| `items search --filter '{"type":"active"}'` | `["items", "search", "--filter", "{\"type\":\"active\"}"]` |
| `cmd hello 'world foo' bar` | `["cmd", "hello", "world foo", "bar"]` |

### Boolean Flag Handling

Boolean parameters follow special rules:

- `--flag true` — Include the flag (equivalent to `--flag`)
- `--flag false` — Omit the flag entirely
- `--flag` (no value) — Boolean flag implicitly set to `true`

## Command Map

The ORC protocol builds a `CommandMap` from the OpenAPI spec by mapping path segments and HTTP methods to a hierarchical structure:

```typescript
type CommandMap = Record<string, ResourceDef>;

interface ResourceDef {
  name: string;
  description?: string;
  functions: Record<string, FuncDef>;
}

interface FuncDef {
  name: string;
  description?: string;
  params: ParamDef[];
}

interface ParamDef {
  name: string;
  type: string;
  description?: string;
  required: boolean;
  boolean: boolean;
  location: "query" | "path" | "body";
  json?: boolean;
}
```

### Resource and Function Resolution

Resources and functions are derived from the OpenAPI spec using these rules:

1. **Path-based resolution**: Path segments become resource and function names.
   - First path segment → resource name
   - Second path segment → function name (unless it matches the HTTP method or resource name)
   - Example: `/users/{id}` → resource: `users`, function: depends on method

2. **Method-based fallback**: When the second segment matches the HTTP method or the resource name, the HTTP method becomes the function name.
   - Example: `/users` with `GET` → resource: `users`, function: `get`

3. **Path placeholders**: Segments wrapped in `{...}` are treated as path parameters, not resources or functions.
   - Example: `/users/{id}/tabs/{tabId}` → resource: `users`, function: `tabs`

4. **Tags as fallback**: Tags are only used as a fallback when the path has no segments (i.e., after stripping path parameters the path is empty or has only one segment). Tags are no longer the primary resolution mechanism — path-based resolution always takes priority.
   - Example: `/{resource}/{action}` with tags `['Content']` → after stripping `{}` → no segments → resource: `content`, function: derived from HTTP method
   - Example: `/tabs/{tabId}/snapshot` → resource: `tabs`, function: `snapshot` (tags ignored, path takes priority)

### Resolution priority

Path-based resolution is checked first. Tags are consulted only when the path provides no usable segments:

```
1. Resolve resource/function from path segments (after stripping {param} placeholders)
2. If path has no segments, fall back to first tag as resource name
3. If neither path nor tags provide a resource, use "default"
```

### Command Map Building Process

1. Iterate over all paths in the OpenAPI spec.
2. For each path, iterate over all HTTP methods.
3. Resolve the resource and function names from the path and method.
4. Extract parameter definitions from:
   - Operation parameters (query, path, header locations)
   - Path template placeholders (added as required path params if not already defined)
   - Request body schema properties (added as body params)
5. Build the `FuncDef` with name, description, and params.
6. Add the function to its resource in the `CommandMap`.

## Operation Resolution

When a command is executed, the protocol resolves it to a concrete OpenAPI operation:

1. **Parse the command string** into resource, function, and flags.
2. **Look up the resource** in the `CommandMap`. If not found, throw `OrcSpecError("Unknown resource: <resource>")`.
3. **Look up the function** within the resource. If not found, throw `OrcSpecError("Unknown function <func> on resource <resource>")`.
4. **Find the matching path template** in the OpenAPI spec by:
   - Matching tags (if the resource name matches the first tag)
   - Matching path structure (if the resource and function match path segments)
5. **Build the resolved path** by replacing `{param}` placeholders with flag values.
6. **Build query parameters** from flags with `location: "query"`.
7. **Build request body** from flags with `location: "body"` (for POST/PUT/PATCH only).

### Parameter Location Rules

| Location | Placement | Handling |
| --- | --- | --- |
| `path` | Replaces `{param}` in the URL path | Required if not provided; `true` (no value) becomes empty string |
| `query` | Appended as URL query parameters | JSON-type params are parsed from string to object/array |
| `body` | Serialized as JSON in the request body | Coerced to the declared type (number, boolean); JSON-type parsed from string |

### Type Coercion

- **Number**: String values are converted to `Number`; non-numeric strings remain as strings.
- **Boolean**: String `"true"` becomes `true`, `"false"` becomes `false`.
- **JSON (object/array)**: String values are parsed via `JSON.parse()`; fallback to string if invalid JSON.

## Help Text Generation

The protocol provides three levels of help text, all generated dynamically from the OpenAPI spec:

### Service-Level Help (`--help`)

```
ORCa: <service title>

<service description>

Available resources:
  <resource1> — <resource description>
  <resource2>

Usage: <resource> <function> [--flag value]
  resource  — The resource name
  function  — The function name (e.g., get, post, delete)
  --flag    — Parameter flags (boolean flags omit value)

Examples:
  <resource1> <first_function> --help
  <resource2> <first_function> --help
```

### Resource-Level Help (`<resource> --help`)

```
Resource: <resource>

<resource description>

Available functions:
  <function1> — <function description>
  <function2>

Usage: <resource> <function> [--flag value]
```

### Function-Level Help (`<resource> <function> --help`)

```
Function: <resource> <function>

<function description>

Parameters:
  --<param1> <type> [boolean] (required) — <description>
  --<param2> <type> (optional)

Example:
  <resource> <function> <param1> [--param2 value]
```

### Help Input Variants

The MCP tool recognizes these help commands:

| Input | Result |
| --- | --- |
| `--help`, `-h`, `help` | Service-level help |
| `<resource> --help`, `<resource> -h`, `<resource> help` | Resource-level help |
| `<resource> <function> --help`, `<resource> <function> -h`, `<resource> <function> help` | Function-level help |

## Authentication

The ORC protocol supports authentication configuration via environment variables and OpenAPI spec security schemes. See `auth.md` for full details.

### Auth Methods

| Method | Env Var | Description |
| --- | --- | --- |
| `none` | `ORCA_AUTH_METHOD=none` | No authentication |
| `bearer` | `ORCA_AUTH_METHOD=bearer` | Bearer token in `Authorization` header |
| `basic` | `ORCA_AUTH_METHOD=basic` | Basic auth (base64-encoded credentials) |
| `apikey` | `ORCA_AUTH_METHOD=apikey` | API key in header, query, or cookie |

### Auth Priority

1. **Environment variable override**: `ORCA_AUTH_METHOD` takes precedence over spec inference.
2. **Spec inference**: If no env var is set, the first `securitySchemes` entry in the OpenAPI spec determines the auth method.

## Error Handling

The protocol uses a custom error class `OrcSpecError` for all spec-related failures:

```typescript
class OrcSpecError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OrcSpecError";
  }
}
```

### Error Cases

| Scenario | Error Message |
| --- | --- |
| Invalid URL in `ORCA_SPEC_ENDPOINT` | `ORCA_SPEC_ENDPOINT is not a valid URL: <url>` |
| Empty or missing spec endpoint | `ORCA_SPEC_ENDPOINT is not set` / `ORCA_SPEC_ENDPOINT is empty` |
| Invalid OpenAPI spec (no paths) | `Invalid OpenAPI spec: no 'paths' section found` |
| Unknown resource | `Unknown resource: <resource>` |
| Unknown function | `Unknown function <func> on resource <resource>` |
| No matching path in spec | `No matching path found for resource=<resource>, function=<func>` |
| Missing required path param | `Missing required path parameter: <param>` |
| HTTP request failure | `Request failed: HTTP <status> — <body>` |

## Transport

ORCa uses the `stdio` transport as defined by the MCP specification. The server is invoked via:

```bash
npx -y @adam-gfam/orca
```

Communication occurs over standard input/output streams. The server registers a single MCP tool called `command_line` that accepts a string input and returns text output.

## Environment Variables

| Variable | Required | Description |
| --- | --- | --- |
| `ORCA_SPEC_ENDPOINT` | Yes | URL of the remote service endpoint serving the OpenAPI spec |
| `ORCA_SERVICE_BASE_URL` | No | URL for live API calls (defaults to spec endpoint or auto-detected from spec) |
| `ORCA_AUTH_METHOD` | No | Auth method override: `none`, `bearer`, `basic`, or `apikey` |
| `ORCA_AUTH_BEARER_TOKEN` | Conditional | Bearer token value (required when `ORCA_AUTH_METHOD=bearer`) |
| `ORCA_AUTH_BASIC_USERNAME` | Conditional | Basic auth username (required when `ORCA_AUTH_METHOD=basic`) |
| `ORCA_AUTH_BASIC_PASSWORD` | Conditional | Basic auth password (required when `ORCA_AUTH_METHOD=basic`) |
| `ORCA_AUTH_APIKEY_NAME` | Conditional | API key parameter name (required when `ORCA_AUTH_METHOD=apikey`) |
| `ORCA_AUTH_APIKEY_VALUE` | Conditional | API key value (required when `ORCA_AUTH_METHOD=apikey`) |
| `ORCA_AUTH_APIKEY_IN` | Optional | API key injection location: `header` (default), `query`, or `cookie` |

## Architecture Flow

```
+----------------+       +------------------+       +-------------------+
|  MCP Client    | <---> |  ORCa Server     | <---> |  Remote Service   |
|  (Claude,      |  stdio |  (TypeScript)    |  HTTP |  (OpenAPI spec)   |
|  Hermes, etc.) |       |                  |       |                   |
+----------------+       +------------------+       +-------------------+
```

1. **MCP Client** sends a tool call with a single string argument (the CLI command).
2. **ORCa Server** parses the input string, routes it to the appropriate resource and function defined in the remote OpenAPI spec.
3. **Remote Service** receives the request according to its OpenAPI contract and returns a response.
4. **ORCa Server** formats the response and returns it to the MCP client.

## Key Components

| Component | File | Purpose |
| --- | --- | --- |
| Input Parser | `src/mcp/tools/input-parser.ts` | Splits CLI string into arguments (quote-aware) |
| Format Args | `src/mcp/tools/format-args.ts` | Pretty-prints parsed arguments for display |
| Spec Loader | `src/orc/client.ts` (validateSpec) | Fetches and parses OpenAPI spec (JSON or YAML) |
| Command Map Builder | `src/orc/client.ts` (buildCommandMap) | Transforms spec into Resource -> Function -> Params |
| Router | `src/orc/client.ts` (resolveOperation, findPathTemplate) | Matches parsed command to OpenAPI path and method |
| HTTP Client | `src/orc/client.ts` (exec) | Uses `undici` to execute HTTP requests |
| Auth Module | `src/orc/auth.ts` | Parses env vars, resolves auth method, injects headers |
| Validation | `src/mcp/validation.ts` | Validates `ORCA_SPEC_ENDPOINT` and `ORCA_SERVICE_BASE_URL` |
| Server | `src/mcp/server.ts` | MCP server setup, tool registration, stdio transport |
