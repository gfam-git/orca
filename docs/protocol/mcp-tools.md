# ORC MCP Tool Reference

## Overview

ORCa exposes a single MCP tool called `command_line` that provides CLI-like access to all operations defined in the remote service's OpenAPI spec. The tool accepts a single string argument and returns text output.

## Tool Definition

### Tool Name

```
command_line
```

### Tool Title

```
Command Line
```

### Tool Description

```
CLI-like tool that accepts a single string input, parses it, and routes it through the connected OpenAPI service. Use --help to see available resources and functions.
```

### Input Schema

```json
{
  "input": {
    "type": "string",
    "description": "The command input string to execute or get help for."
  }
}
```

## Input Parsing

The input string is parsed by the `parseArguments()` function, which splits on whitespace while preserving quoted strings and escaped characters.

### Parsing Rules

1. **Whitespace splitting**: Arguments separated by spaces, tabs, newlines, carriage returns.
2. **Quote preservation**: Content in matching single (`'`) or double (`"`) quotes is a single argument. Quotes are stripped.
3. **Escape handling**: Inside quotes, `\"` and `\'` preserve the backslash and next character.
4. **Token boundary**: Quotes only start at the beginning of a token.

### Examples

| Input | Parsed |
| --- | --- |
| `users get --id 123` | `["users", "get", "--id", "123"]` |
| `tabs create --name 'My Tab'` | `["tabs", "create", "--name", "My Tab"]` |
| `items search --filter '{"type":"active"}'` | `["items", "search", "--filter", "{\"type\":\"active\"}"]` |

## Command Routing

After parsing, the command is interpreted as:

```
<resource> <function> [--flag value] [--flag2]
```

- First argument → resource name
- Second argument → function name
- Remaining `--flag` pairs → parameters

## Help Commands

The tool recognizes three levels of help, triggered by specific input patterns:

### Service-Level Help

| Input | Result |
| --- | --- |
| `--help` | Help for entire service |
| `-h` | Help for entire service |
| `help` | Help for entire service |

**Output format:**
```
ORCa: <service title>

<service description>

Available resources:
  <resource1> — <description>
  <resource2>

Usage: <resource> <function> [--flag value]
  resource  — The resource name
  function  — The function name (e.g., get, post, delete)
  --flag    — Parameter flags (boolean flags omit value)

Examples:
  <resource1> <first_function> --help
  <resource2> <first_function> --help
```

### Resource-Level Help

| Input | Result |
| --- | --- |
| `<resource> --help` | Help for resource |
| `<resource> -h` | Help for resource |
| `<resource> help` | Help for resource |

**Output format:**
```
Resource: <resource>

<resource description>

Available functions:
  <function1> — <description>
  <function2>

Usage: <resource> <function> [--flag value]
```

### Function-Level Help

| Input | Result |
| --- | --- |
| `<resource> <function> --help` | Help for function |
| `<resource> <function> -h` | Help for function |
| `<resource> <function> help` | Help for function |

**Output format:**
```
Function: <resource> <function>

<function description>

Parameters:
  --<param1> <type> [boolean] (required) — <description>
  --<param2> <type> (optional)

Example:
  <resource> <function> <param1> [--param2 value]
```

## Execution

When the input does not match a help pattern, it is executed as a command:

1. Parse the command string into resource, function, and flags.
2. Look up the resource in the command map.
3. Look up the function within the resource.
4. Resolve to the matching OpenAPI path and method.
5. Build the request (path, query, body) from flags.
6. Inject authentication headers.
7. Send the HTTP request to the remote service.
8. Return the response body as text.

## Output Format

### Successful Response

The tool returns a content object with `type: "text"` and the response body as text:

```json
{
  "content": [
    {
      "type": "text",
      "text": "<response body from remote service>"
    }
  ]
}
```

### Error Response

Errors are returned with `isError: true`:

```json
{
  "content": [
    {
      "type": "text",
      "text": "Error: <error message>"
    }
  ],
  "isError": true
}
```

### Error Types

| Error | Example |
| --- | --- |
| Unknown resource | `Error: Unknown resource: foo` |
| Unknown function | `Error: Unknown function bar on resource users` |
| No matching path | `Error: No matching path found for resource=users, function=bar` |
| Missing required param | `Error: Missing required path parameter: id` |
| HTTP failure | `Error: Request failed: HTTP 404 — Not Found` |
| Not connected | `Error: Not connected. Call connect() first.` |
| Help error | `Error: Help error: <message>` |
| Spec error | `Error: Invalid OpenAPI spec: no 'paths' section found` |

## Boolean Parameter Handling

Boolean parameters in commands follow these rules:

| Command | Behavior |
| --- | --- |
| `--flag true` | Include the flag (value = true) |
| `--flag false` | Omit the flag entirely |
| `--flag` (no value) | Boolean flag implicitly true |

## Parameter Locations

Parameters are placed in the request based on their location:

| Location | Placement | Example |
| --- | --- | --- |
| `path` | Replaces `{param}` in URL | `--id 123` → `/users/123` |
| `query` | URL query parameter | `--page 2` → `?page=2` |
| `body` | JSON body field | `--name "Test"` → `{"name": "Test"}` |

## Type Coercion

| Param Type | Coercion |
| --- | --- |
| `string` | Used as-is |
| `number` | String converted to Number; non-numeric stays string |
| `boolean` | `"true"` → true, `"false"` → false |
| `object` / `array` (json) | String parsed via `JSON.parse()`; fallback to string |

## Full Request Flow

```
MCP Client
  │
  │ Tool call: command_line(input="users get --id 123")
  ▼
ORCa Server
  │
  │ 1. Check help patterns (--help, <resource> --help, <resource> <func> --help)
  │ 2. Parse command: resource="users", func="get", flags={id: "123"}
  │ 3. Resolve to OpenAPI path: /users/{id}, method: GET
  │ 4. Build request: path="/users/123", query={}, body=null
  │ 5. Inject auth headers
  │ 6. Send HTTP GET /users/123
  ▼
Remote Service
  │
  │ Returns response body
  ▼
ORCa Server
  │
  │ Returns { content: [{ type: "text", text: "<response>" }] }
  ▼
MCP Client
```

## Usage Examples

### List Resources

```
--help
```

### Get Help for a Resource

```
users --help
```

### Get Help for a Function

```
users get --help
```

### Execute a Command

```
users get --id 123
```

### Execute with Boolean Flag

```
items delete --id 42 --force true
```

### Execute with JSON Body

```
items create --name 'My Item' --schema '{"type":"object"}'
```
