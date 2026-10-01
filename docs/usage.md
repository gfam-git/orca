# ORCa — General Usage Guide

This document covers practical usage patterns and workflows for end users who want to use ORCa with their OpenAPI-backed services. For protocol-level details, see the [protocol specification](protocol/protocol.md); for authentication setup, see [auth.md](auth.md).

---

## 1. Typical Usage Workflows

### Connecting to a Service

The first step is always to tell ORCa where to find the OpenAPI spec:

```bash
export ORCA_SPEC_ENDPOINT=https://api.example.com/openapi.json
```

When the ORCa server starts, it fetches and parses the spec automatically. If the spec defines server URLs (in the `servers` property), ORCa auto-detects the base URL for live API calls. If not, it falls back to `ORCA_SPEC_ENDPOINT` itself.

To override the live API URL independently of the spec URL:

```bash
export ORCA_SERVICE_BASE_URL=https://api-prod.example.com
```

This is useful when the spec endpoint and the actual API endpoint differ (e.g., the spec is hosted at a documentation URL but the API lives elsewhere).

### Exploring Resources

Once connected, use `--help` to explore what the service offers:

```bash
# Service-level: list all resources
--help

# Resource-level: list functions on a resource
users --help

# Function-level: list parameters for a function
users get --help
```

Help text is generated directly from the OpenAPI spec — resource names, function names, parameter descriptions, and types all come from the spec. This means you never need to memorize commands; the spec is the source of truth.

### Executing Commands

The basic command pattern is:

```bash
<resource> <function> [--flag value]
```

For example:

```bash
users get --id 123
items create --name 'New Item' --tags '["urgent","feature"]'
```

---

## 2. Common Command Patterns

### Simple GET Requests

```bash
# GET /users/123
users get --id 123

# GET /users?page=2&limit=50
users list --page 2 --limit 50
```

### POST with Request Body

```bash
# POST /users with JSON body
users create --name 'Alice' --email 'alice@example.com' --role user
```

### PUT / PATCH / DELETE

```bash
# PUT /users/123
users update --id 123 --name 'Alice Updated'

# DELETE /users/123
users delete --id 123
```

### Commands with Multiple Flags

```bash
# Multiple flags in one command
items search --filter '{"status":"active"}' --sort created_at --page 1 --limit 10
```

---

## 3. Working with Parameters

### Path Parameters

Path parameters are extracted from the URL path template (e.g., `/users/{id}`) and become required flags:

```bash
# Path template: /users/{id}
# Flag: --id (required)
users get --id 42
```

If a required path parameter is missing, ORCa returns an error:

```
Error: Missing required path parameter: id
```

### Query Parameters

Query parameters are optional by default and appended to the URL:

```bash
# GET /users?page=2&sort=name
users list --page 2 --sort name
```

Query parameters with `json` type (object or array schema) are parsed as JSON:

```bash
# Query param with JSON filter
items search --filter '{"status":"active"}'
# → /items/search?filter={"status":"active"}
```

### Request Body Parameters

For POST, PUT, and PATCH operations, body parameters are collected into a JSON object:

```bash
# POST /users
# Body: {"name": "Alice", "email": "alice@example.com"}
users create --name 'Alice' --email 'alice@example.com'
```

---

## 4. JSON Parameter Handling

Parameters whose schema type is `object` or `array` are treated as JSON. When you pass a flag value for such a parameter, ORCa attempts to parse it as JSON:

```bash
# Pass a JSON object as a flag value
items create --name 'New Item' --schema '{"type":"object","properties":{"color":"string"}}'

# Pass a JSON array as a flag value
items create --name 'Bulk Create' --tags '["urgent","feature"]'
```

If the value is valid JSON, it is parsed into the actual object or array. If parsing fails, the value is kept as a string:

```bash
# Not valid JSON — kept as string
items create --name 'Test' --metadata 'not-json'
# Body: {"metadata": "not-json"}
```

This is useful for passing complex nested data without needing a file:

```bash
# Nested JSON object
deployments create --config '{"replicas":3,"strategy":"rolling"}'
```

---

## 5. Number and Boolean Type Coercion

ORCa performs type coercion on body parameters based on the OpenAPI schema type:

### Number Coercion

String values are converted to numbers when the schema type is `number` or `integer`:

```bash
# Schema type: integer
items create --count '42'
# Body: {"count": 42}

# Non-numeric string — kept as string
items create --count 'abc'
# Body: {"count": "abc"}
```

### Boolean Coercion

String values `"true"` and `"false"` are converted to boolean:

```bash
# Schema type: boolean
items create --name 'Test' --enabled 'true'
# Body: {"enabled": true}
```

### Boolean Flag Semantics

In the CLI, boolean flags follow special rules:

| Command | Behavior |
| --- | --- |
| `--flag true` | Include the flag (value = true) |
| `--flag false` | Omit the flag entirely |
| `--flag` (no value) | Boolean flag implicitly true |

For example:

```bash
# Include debug mode
items search --debug true

# Omit debug mode (same as not passing --debug at all)
items search --debug false

# Implicitly true (same as --debug true)
items search --debug
```

---

## 6. Service Base URL Configuration

### Auto-Detection from Spec

By default, ORCa extracts the server URL from the OpenAPI spec's `servers` property:

1. **Top-level** `servers[0].url` is tried first.
2. If no valid top-level URL, the **first per-path** server URL is used.
3. If neither exists, the URL falls back to `ORCA_SPEC_ENDPOINT`.

Example spec with servers:

```yaml
openapi: 3.0.0
info:
  title: Example API
servers:
  - url: https://api.example.com/v1
paths:
  /users:
    get:
      ...
```

With this spec, ORCa automatically sends requests to `https://api.example.com/v1`.

### Manual Override

Set `ORCA_SERVICE_BASE_URL` to override auto-detection:

```bash
export ORCA_SPEC_ENDPOINT=https://api.example.com/spec/openapi.json
export ORCA_SERVICE_BASE_URL=https://api-staging.example.com
```

This is useful when:
- The spec is hosted at a different URL than the live API.
- You want to switch between staging and production without changing the spec endpoint.
- The spec does not define any `servers` property.

---

## 7. Debugging Tips

### Spec Fetch Failures

**Error:** `Failed to fetch spec from <url>: HTTP 4xx`

**Fix:**
- Verify `ORCA_SPEC_ENDPOINT` points to a valid, reachable URL.
- Check that the URL returns a valid OpenAPI 3.x or 3.1 document (JSON or YAML).
- Ensure the endpoint is not behind authentication or network restrictions.

```bash
# Test the endpoint directly
curl https://api.example.com/openapi.json
```

### Invalid Spec

**Error:** `Invalid OpenAPI spec: no 'paths' section found`

**Fix:**
- Ensure the URL points to an OpenAPI document, not a Swagger UI page or API documentation HTML.
- Verify the document has a top-level `paths` object.

### Command Parsing Errors

**Error:** `Unknown resource: <name>`

**Fix:**
- Use `--help` to see available resources.
- Check resource names are lowercase and match the spec.

**Error:** `Unknown function <name> on resource <resource>`

**Fix:**
- Use `<resource> --help` to see available functions.
- Function names are derived from HTTP methods (`get`, `post`, `put`, `patch`, `delete`) or path segments.

**Error:** `No matching path found for resource=<resource>, function=<func>`

**Fix:**
- The resource and function exist in the command map but cannot be matched to a concrete OpenAPI path.
- Check that the OpenAPI spec has the expected path structure.
- Verify the spec's tags or path segments match your resource/function names.

### Missing Required Path Parameter

**Error:** `Missing required path parameter: <name>`

**Fix:**
- Add the missing `--<name>` flag to your command.

```bash
# Wrong
users get

# Correct
users get --id 123
```

### Authentication Errors

**Error:** `ORCA_AUTH_BEARER_TOKEN is required when auth method is 'bearer'`

**Fix:**
- Set the required environment variable:

```bash
export ORCA_AUTH_METHOD=bearer
export ORCA_AUTH_BEARER_TOKEN=your_token_here
```

See [auth.md](auth.md) for the full list of auth environment variables and configuration options.

### HTTP Request Failures

**Error:** `Request failed: HTTP 401 — Unauthorized`

**Fix:**
- Verify auth credentials are correct.
- Check that the token has not expired.
- Ensure the auth method matches the service's expectations.

**Error:** `Request failed: HTTP 404 — Not Found`

**Fix:**
- The resource or function path does not exist on the remote service.
- Verify the OpenAPI spec matches the live service.
- Check for URL path prefix issues (e.g., `/v1/users` vs `/users`).

---

## 8. Integration Patterns with MCP Clients

ORCa is designed as an MCP-compatible stdio server, meaning it can be used by any MCP client that supports stdio transport. Here are common integration patterns:

### Claude Code

```bash
# Set environment variables
export ORCA_SPEC_ENDPOINT=https://api.example.com/openapi.json

# Start Claude Code with ORCa as a tool
claude --tool command_line
```

Claude Code will receive the `command_line` tool from ORCa and can use it to interact with any OpenAPI-backed service.

### Hermes Agent

```bash
# Configure Hermes to use ORCa
hermes model qwen-3-6-35b
# ORCa runs as an MCP server; Hermes connects via stdio
```

Hermes can invoke ORCa's `command_line` tool through its MCP integration, allowing autonomous agents to interact with OpenAPI services using natural language commands.

### Other MCP Clients

Any MCP client supporting stdio transport can use ORCa:

1. Ensure `ORCA_SPEC_ENDPOINT` is set.
2. Start the ORCa server (`npm start` or `ts-node src/index.ts`).
3. Configure the MCP client to connect to ORCa's stdio transport.
4. Use the `command_line` tool to send commands.

### Using ORCa as a Library

ORCa can also be imported as an npm package (`@adam-gfam/orca`) and used programmatically:

```typescript
import { OrcClient } from '@adam-gfam/orca';

const client = new OrcClient();
await client.connect('https://api.example.com/openapi.json');

// Get help text
console.log(client.help());

// Execute a command
const result = await client.exec('users get --id 123');
console.log(result);
```

See the [API reference](reference/api-reference.md) for full type signatures and function documentation.

---

## Quick Reference

| Command | Description |
| --- | --- |
| `--help` | Service-level help (list all resources) |
| `<resource> --help` | Resource-level help (list functions) |
| `<resource> <func> --help` | Function-level help (list parameters) |
| `<resource> <func> --flag value` | Execute a command |
| `export ORCA_SPEC_ENDPOINT=<url>` | Set the OpenAPI spec endpoint |
| `export ORCA_SERVICE_BASE_URL=<url>` | Override the live API URL |
| `export ORCA_AUTH_METHOD=bearer` | Set auth method |

For complete environment variable documentation, see [environment-variables.md](reference/environment-variables.md).