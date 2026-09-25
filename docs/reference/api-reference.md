# ORCa API Reference

This document covers the programmatic API surface for developers using ORCa as a library. All types, interfaces, and exported functions are documented with their signatures, behaviors, and usage patterns.

---

## Table of Contents

- [Core Types](#core-types)
  - [ParamDef](#paramdef)
  - [FuncDef](#funcdef)
  - [ResourceDef](#resourcedef)
  - [CommandMap](#commandmap)
  - [ResolvedOperation](#resolvedoperation)
  - [ParsedCommand](#parsedcommand)
- [Client Interface](#client-interface)
  - [ORCClient](#orclient)
- [Authentication Types](#authentication-types)
  - [AuthConfig](#authconfig)
  - [AuthMethod](#authmethod)
  - [SecurityScheme](#securityscheme)
- [Exported Functions](#exported-functions)
  - [buildCommandMap](#buildcommandmap)
  - [parseCommand](#parsecommand)
  - [resolveOperation](#resolveoperation)
  - [help](#help)
  - [helpResource](#helpresource)
  - [helpFunction](#helpfunction)
  - [extractServerUrl](#extractserverurl)
- [Authentication Functions](#authentication-functions)
  - [parseAuthConfig](#parseauthconfig)
  - [injectAuthHeaders](#injectauthheaders)
  - [injectApiKeyQuery](#injectapikeyquery)
- [Error Classes](#error-classes)
  - [OrcSpecError](#orcspecerror)
- [MCP Tool Exports](#mcp-tool-exports)
  - [parseArguments](#parsearguments)
  - [formatArguments](#formatarguments)

---

## Core Types

### ParamDef

A parameter definition extracted from an OpenAPI operation. Used by the command map builder and operation resolver to map CLI flags to HTTP request components.

```typescript
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

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `name` | `string` | Yes | Parameter name (e.g., `"groupName"`, `"debug"`) |
| `type` | `string` | Yes | Parameter type string (e.g., `"string"`, `"boolean"`, `"integer"`) |
| `description` | `string` | No | Parameter description from the OpenAPI spec |
| `required` | `boolean` | Yes | Whether this parameter is required |
| `boolean` | `boolean` | Yes | Whether this is a boolean parameter |
| `location` | `"query" \| "path" \| "body"` | Yes | Where this parameter lives in the HTTP request |
| `json` | `boolean` | No | Whether this parameter should be parsed as JSON (object/array types) |

### FuncDef

A function (operation) on a resource. Represents a single OpenAPI operation mapped into the CLI command structure.

```typescript
interface FuncDef {
  name: string;
  description?: string;
  params: ParamDef[];
}
```

| Property | Type | Description |
|----------|------|-------------|
| `name` | `string` | Function name (e.g., `"get"`, `"post"`, `"delete"`) |
| `description` | `string` | Function description from the spec, if any |
| `params` | `ParamDef[]` | Parameter definitions for this function |

### ResourceDef

A resource (path group) containing functions. Represents a top-level path segment in the OpenAPI spec.

```typescript
interface ResourceDef {
  name: string;
  description?: string;
  functions: Record<string, FuncDef>;
}
```

| Property | Type | Description |
|----------|------|-------------|
| `name` | `string` | Resource name (e.g., `"users"`, `"tabs"`, `"items"`) |
| `description` | `string` | Resource description from the spec, if any |
| `functions` | `Record<string, FuncDef>` | Function definitions for this resource |

### CommandMap

The full command map: a record mapping resource names to their definitions. This is the primary data structure that bridges the OpenAPI spec to CLI commands.

```typescript
type CommandMap = Record<string, ResourceDef>;
```

### ResolvedOperation

An OpenAPI operation resolved into a concrete HTTP request. Produced by `resolveOperation()` and consumed by `exec()`.

```typescript
interface ResolvedOperation {
  path: string;
  method: string;
  body: Record<string, unknown> | null;
  query: Record<string, string | number | boolean>;
  pathTemplate: string;
  summary: string;
  description: string;
}
```

| Property | Type | Description |
|----------|------|-------------|
| `path` | `string` | Absolute path with placeholders replaced (e.g., `"/users/123"`) |
| `method` | `string` | HTTP method (e.g., `"GET"`, `"POST"`) |
| `body` | `Record<string, unknown> \| null` | Body to send for POST/PUT/PATCH, or `null` for GET/DELETE |
| `query` | `Record<string, string \| number \| boolean>` | Query parameters to append |
| `pathTemplate` | `string` | Original path template for help text |
| `summary` | `string` | Original operation summary |
| `description` | `string` | Original operation description |

### ParsedCommand

Parsed command components. Produced by `parseCommand()` and consumed by `resolveOperation()`.

```typescript
interface ParsedCommand {
  resource: string;
  func: string;
  flags: Record<string, string | boolean>;
}
```

| Property | Type | Description |
|----------|------|-------------|
| `resource` | `string` | The resource name from the command |
| `func` | `string` | The function name from the command |
| `flags` | `Record<string, string \| boolean>` | Key-value pairs for `--flag` arguments. Boolean flags set `true` (no value) or `false` (omit) |

---

## Client Interface

### ORCClient

The public interface for the ORC client. All ORC functionality lives on this single exported type. Implemented by `OrcClient`.

```typescript
interface ORCClient {
  isConnected: boolean;
  url: string;
  serviceBaseUrl?: string;
  spec: unknown;
  commandMap: CommandMap;
  authConfig: AuthConfig;

  connect(url: string): Promise<void>;
  disconnect(): void;
  getSpecJson(): string;
  getSpec(): unknown;
  help(): string;
  helpResource(resource: string): string;
  helpFunction(resource: string, func: string): string;
  exec(command: string): Promise<string>;
  parseCommand(command: string): ParsedCommand;
}
```

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `isConnected` | `boolean` | Whether the client has successfully connected and loaded a spec |
| `url` | `string` | The URL the client is connected to (set after connect) |
| `serviceBaseUrl` | `string` | The base URL for live API calls (set after connect; defaults to `url` if unset) |
| `spec` | `unknown` | The raw OpenAPI spec object (parsed) |
| `commandMap` | `CommandMap` | The parsed command map |
| `authConfig` | `AuthConfig` | The resolved authentication configuration |

### Methods

#### connect(url)

Connect to a remote service, fetch its OpenAPI spec, and parse it.

```typescript
connect(url: string): Promise<void>;
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `url` | `string` | The URL of the remote service's OpenAPI endpoint |

**Behavior:**
1. Validates the URL format
2. Fetches the spec from `url`
3. Parses and validates the spec (JSON or YAML)
4. Auto-detects server URL from the spec's `servers` property
5. Parses authentication config from spec security schemes and environment variables
6. Builds the command map from the spec
7. Sets `isConnected = true`

**Throws:** `OrcSpecError` if the URL is invalid, the response is not successful, the body is empty, or the spec is invalid.

#### disconnect()

Disconnect and clear internal state.

```typescript
disconnect(): void;
```

Resets all properties to their initial values (`isConnected = false`, `url = ""`, `spec = null`, `commandMap = {}`, `authConfig = { method: "none" }`).

#### getSpecJson()

Get the OpenAPI spec as a JSON string.

```typescript
getSpecJson(): string;
```

**Throws:** `OrcSpecError` if not connected.

#### getSpec()

Get the parsed OpenAPI spec object.

```typescript
getSpec(): unknown;
```

#### help()

Generate help text for the entire service (lists all resources).

```typescript
help(): string;
```

**Throws:** `OrcSpecError` if not connected.

#### helpResource(resource)

Generate help text for a specific resource.

```typescript
helpResource(resource: string): string;
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `resource` | `string` | Resource name |

**Throws:** `OrcSpecError` if not connected or resource is unknown.

#### helpFunction(resource, func)

Generate help text for a specific function on a resource.

```typescript
helpFunction(resource: string, func: string): string;
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `resource` | `string` | Resource name |
| `func` | `string` | Function name |

**Throws:** `OrcSpecError` if not connected, resource is unknown, or function is unknown.

#### exec(command)

Execute a command string against the remote service.

```typescript
exec(command: string): Promise<string>;
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `command` | `string` | The command string (e.g., `"users get --id 123"`) |

**Returns:** The response body as a JSON string.

**Behavior:**
1. Parses the command into `ParsedCommand`
2. Resolves to a `ResolvedOperation`
3. Builds the request URL (prepends `serviceBaseUrl`, appends query params)
4. Injects authentication headers and API key
5. Sends the HTTP request via `undici`
6. Returns the response body

**Throws:** `OrcSpecError` if not connected, or if the HTTP response status is not 2xx.

#### parseCommand(command)

Parse a command string into its components.

```typescript
parseCommand(command: string): ParsedCommand;
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `command` | `string` | The command string |

**Returns:** `ParsedCommand` with `resource`, `func`, and `flags`.

---

## Authentication Types

### AuthConfig

Authentication configuration parsed from environment variables or spec inference.

```typescript
interface AuthConfig {
  method: AuthMethod;
  bearerToken?: string;
  basicUsername?: string;
  basicPassword?: string;
  apikeyName?: string;
  apikeyValue?: string;
  apikeyIn?: "header" | "query" | "cookie";
}
```

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `method` | `AuthMethod` | Yes | The resolved auth method |
| `bearerToken` | `string` | Conditional | Bearer token value (required when `method === "bearer"`) |
| `basicUsername` | `string` | Conditional | Basic auth username (required when `method === "basic"`) |
| `basicPassword` | `string` | Conditional | Basic auth password (required when `method === "basic"`) |
| `apikeyName` | `string` | Conditional | API key parameter name (required when `method === "apikey"`) |
| `apikeyValue` | `string` | Conditional | API key value (required when `method === "apikey"`) |
| `apikeyIn` | `"header" \| "query" \| "cookie"` | No | Where to inject the API key (default: `"header"`) |

### AuthMethod

Union type of supported authentication methods.

```typescript
type AuthMethod = "none" | "bearer" | "basic" | "apikey";
```

| Value | Description |
|-------|-------------|
| `"none"` | No authentication |
| `"bearer"` | Bearer token authentication |
| `"basic"` | HTTP Basic authentication |
| `"apikey"` | API key authentication |

### SecurityScheme

OpenAPI security scheme type mapping. Represents a security scheme from `components.securitySchemes`.

```typescript
interface SecurityScheme {
  type: string;
  name?: string;
  in?: string;
  scheme?: string;
  bearerFormat?: string;
}
```

| Property | Type | Description |
|----------|------|-------------|
| `type` | `string` | Scheme type (e.g., `"http"`, `"apiKey"`) |
| `name` | `string` | Parameter name (for `apiKey` type) |
| `in` | `string` | Location of the API key (`"query"`, `"header"`, `"cookie"`) |
| `scheme` | `string` | Auth scheme (e.g., `"bearer"`, `"basic"`) |
| `bearerFormat` | `string` | Token format hint (e.g., `"JWT"`) |

---

## Exported Functions

### buildCommandMap

Transforms an OpenAPI spec into a `CommandMap`, mapping paths and methods to resources and functions.

```typescript
function buildCommandMap(spec: OpenApiSpec): CommandMap;
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `spec` | `OpenApiSpec` | The parsed OpenAPI spec object |

**Mapping Rules:**
- Path segments become resource names (first segment) and function names (second segment)
- For paths like `/users/{id}`, the resource is the first path group
- HTTP methods become function names (`get`, `post`, `put`, `patch`, `delete`, etc.)
- If the function name matches the resource name, the method type is used (e.g., `"item get"`)
- Parameters become flags with `--name value` format
- Boolean parameters: omit value if `true`, omit flag if `false`

**Returns:** A `CommandMap` object mapping resource names to `ResourceDef` objects.

### parseCommand

Parses a command string into `ParsedCommand` components.

```typescript
function parseCommand(command: string): ParsedCommand;
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `command` | `string` | The command string (e.g., `"users get --id 123 --debug true"`) |

**Parsing Rules:**
- Format: `<resource> <function> [--flag value] [--flag2]`
- Outer quotes are stripped; internal quotes are preserved
- Escaped quotes (`\"` and `\'`) are handled inside quoted strings
- Boolean flags: `--flag true` means include the flag; `--flag false` means omit it
- Flags without values are treated as boolean `true`

**Returns:** A `ParsedCommand` object.

### resolveOperation

Resolves a parsed command to a concrete OpenAPI operation.

```typescript
function resolveOperation(
  command: ParsedCommand,
  commandMap: CommandMap,
  spec: OpenApiSpec
): ResolvedOperation;
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `command` | `ParsedCommand` | The parsed command components |
| `commandMap` | `CommandMap` | The command map from `buildCommandMap()` |
| `spec` | `OpenApiSpec` | The OpenAPI spec |

**Behavior:**
1. Finds the resource and function in the command map
2. Finds the matching path template in the spec (by tags or path structure)
3. Replaces path placeholders with flag values
4. Builds query parameters (JSON-type params are parsed as JSON)
5. Builds request body (coerces types: numbers, booleans, JSON)
6. Returns a `ResolvedOperation`

**Throws:** `OrcSpecError` if the resource or function is unknown, or if a required path parameter is missing.

### help

Service-level help generator. Lists all available resources.

```typescript
function help(commandMap: CommandMap, spec: OpenApiSpec): string;
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `commandMap` | `CommandMap` | The parsed command map |
| `spec` | `OpenApiSpec` | The OpenAPI spec |

**Output format:**
```
ORCa: <spec title>

<spec description>

Available resources:
  <resource> — <description>
  ...

Usage: <resource> <function> [--flag value]
  resource  — The resource name
  function  — The function name (e.g., get, post, delete)
  --flag    — Parameter flags (boolean flags omit value)

Examples:
  <resource> <function> --help
  ...
```

### helpResource

Resource-level help generator. Lists all functions on a resource.

```typescript
function helpResource(commandMap: CommandMap, resource: string): string;
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `commandMap` | `CommandMap` | The parsed command map |
| `resource` | `string` | Resource name |

**Output format:**
```
Resource: <resource>

<resource description>

Available functions:
  <func> — <description>
  ...

Usage: <resource> <function> [--flag value]
```

### helpFunction

Function-level help generator. Lists all parameters for a specific function.

```typescript
function helpFunction(commandMap: CommandMap, resource: string, func: string): string;
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `commandMap` | `CommandMap` | The parsed command map |
| `resource` | `string` | Resource name |
| `func` | `string` | Function name |

**Output format:**
```
Function: <resource> <func>

<function description>

Parameters:
  --<name> <type> [boolean] (required) — <description>
  ...

Example:
  <resource> <func> <params>
```

### extractServerUrl

Extracts the best available server URL from an OpenAPI spec.

```typescript
function extractServerUrl(spec: OpenApiSpec): string | null;
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `spec` | `OpenApiSpec` | The OpenAPI spec |

**Priority:**
1. Top-level `servers[0].url` (valid URLs only)
2. First per-path server URL (valid URLs only)
3. `null` if no valid URL found

**Returns:** The best server URL, or `null` if none found.

---

## Authentication Functions

### parseAuthConfig

Parses authentication configuration from environment variables and spec security schemes.

```typescript
function parseAuthConfig(
  specSecuritySchemes?: Record<string, SecurityScheme>
): AuthConfig;
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `specSecuritySchemes` | `Record<string, SecurityScheme>` | Optional security schemes from the OpenAPI spec |

**Priority:**
1. `ORCA_AUTH_METHOD` env var (override)
2. Infer from spec's `components.securitySchemes` (first scheme)
3. `"none"` if neither is available

**Inference Rules:**
- `type: "http"` with `scheme: "bearer"` → `"bearer"`
- `type: "http"` with `scheme: "basic"` → `"basic"`
- `type: "apiKey"` → `"apikey"`
- Otherwise → `"none"`

**Required Environment Variables:**
- `ORCA_AUTH_BEARER_TOKEN` — required when `method === "bearer"`
- `ORCA_AUTH_BASIC_USERNAME` — required when `method === "basic"`
- `ORCA_AUTH_BASIC_PASSWORD` — required when `method === "basic"`
- `ORCA_AUTH_APIKEY_NAME` — required when `method === "apikey"`
- `ORCA_AUTH_APIKEY_VALUE` — required when `method === "apikey"`
- `ORCA_AUTH_APIKEY_IN` — optional; `"header"` (default), `"query"`, or `"cookie"`

**Throws:** `Error` if a required environment variable is missing or an unsupported method is specified.

### injectAuthHeaders

Injects authentication headers into a request headers object.

```typescript
function injectAuthHeaders(
  headers: Record<string, string>,
  config: AuthConfig
): void;
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `headers` | `Record<string, string>` | The headers object to modify (mutated in place) |
| `config` | `AuthConfig` | The auth configuration |

**Injection Rules:**
- `"none"`: No headers added
- `"bearer"`: Sets `Authorization: Bearer <token>`
- `"basic"`: Sets `Authorization: Basic <base64(username:password)>`
- `"apikey"` with `in: "header"`: Sets `<apikeyName>: <apikeyValue>`
- `"apikey"` with `in: "cookie"`: Sets `Cookie: <apikeyName>=<apikeyValue>`
- `"apikey"` with `in: "query"`: Skips header injection (handled by `injectApiKeyQuery`)

### injectApiKeyQuery

Injects an API key into query parameters.

```typescript
function injectApiKeyQuery(
  query: Record<string, string | number | boolean>,
  config: AuthConfig
): void;
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `query` | `Record<string, string \| number \| boolean>` | The query object to modify (mutated in place) |
| `config` | `AuthConfig` | The auth configuration |

**Behavior:** If `config.method === "apikey"` and `config.apikeyIn === "query"`, sets `query[config.apikeyName] = config.apikeyValue`.

---

## Error Classes

### OrcSpecError

Custom error class for ORC spec-related failures. Used throughout the client for validation errors, missing resources/functions, and HTTP errors.

```typescript
class OrcSpecError extends Error {
  constructor(message: string);
}
```

| Property | Value | Description |
|----------|-------|-------------|
| `name` | `"OrcSpecError"` | Always set to `"OrcSpecError"` |
| `message` | `string` | The error message |

---

## MCP Tool Exports

### parseArguments

Quote-aware CLI argument parser. Used by the MCP tool to split a single-string input into an array of arguments.

```typescript
function parseArguments(input: string): string[];
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `input` | `string` | The raw command string supplied by the user |

**Behavior:**
- Splits on whitespace (`space`, `tab`, `newline`, `carriage return`)
- Characters wrapped in matching single (`'`) or double (`"`) quotes are preserved as a single argument
- Quote characters are preserved in the output (they are part of the argument)
- Escaped quotes (`\"` and `\'`) inside quoted strings are handled correctly

**Example:**
```
parseArguments('users get --id "123" --schema \'{"type":"object"}\'')
// → ["users", "get", "--id", "123", "--schema", '{"type":"object"}']
```

### formatArguments

Pretty-prints parsed arguments as a multi-line string.

```typescript
function formatArguments(args: string[]): string;
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `args` | `string[]` | The parsed argument list |

**Output format:**
```
Arguments (N):
  [ 0] 'arg1'
  [ 1] 'arg2'
  ...
```

**Returns:** A multi-line string suitable for display. Returns `"No arguments provided."` for empty input.
