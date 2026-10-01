# ORC Usage Guide

## Overview

This guide covers practical usage patterns, workflows, debugging, and integration tips for ORCa — the OpenAPI as Remote CLI implementation.

## Getting Started

### Prerequisites

- Node.js (LTS version)
- npm

### Start the Server

```bash
npx -y @adam-gfam/orca
```

Before running, set the required environment variable:

```bash
export ORCA_SPEC_ENDPOINT=https://api.example.com/openapi.json
```

The server will refuse to start if `ORCA_SPEC_ENDPOINT` is unset, empty, or not a valid URL.

## Command Patterns

### Basic Command

```
<resource> <function>
```

Example:
```
users get
```

### Command with Parameters

```
<resource> <function> --<param> <value>
```

Example:
```
users get --id 123
```

### Command with Multiple Parameters

```
<resource> <function> --<param1> <value1> --<param2> <value2>
```

Example:
```
items create --name 'My Item' --status active
```

### Command with Boolean Parameters

```
<resource> <function> --<bool-param> true
<resource> <function> --<bool-param> false
<resource> <function> --<bool-param>
```

| Syntax | Result |
| --- | --- |
| `--debug true` | Include the flag |
| `--debug false` | Omit the flag |
| `--debug` | Boolean flag implicitly true |

Example:
```
items delete --id 42 --force true
```

### Command with Quoted Values

Use single (`'`) or double (`"`) quotes to preserve spaces and special characters:

```
tabs create --name 'My Tab Group'
items search --filter '{"type":"active","limit":10}'
```

### Command with Escaped Characters

Inside quoted strings, escape quotes with backslash:

```
cmd --value '"hello world"'
cmd --value "'nested quotes'"
```

## Help Workflows

### Discover Available Resources

```
--help
```

Output:
```
ORCa: My API Service

A description of the API

Available resources:
  users — User management
  items — Item operations
  tabs — Browser tab control

Usage: <resource> <function> [--flag value]

Examples:
  users get --help
  items create --help
```

### Explore a Resource

```
users --help
```

Output:
```
Resource: users

User management

Available functions:
  get — Retrieve a user
  post — Create a user
  delete — Remove a user

Usage: <resource> <function> [--flag value]
```

### Explore a Function

```
users get --help
```

Output:
```
Function: users get

Retrieve a user

Parameters:
  --id string (required) — The user ID
  --include string (optional) — Fields to include

Example:
  users get <id> [--include value]
```

## Parameter Handling

### Path Parameters

Path parameters are extracted from the OpenAPI path template (segments wrapped in `{...}`). They are always required and replace the placeholder in the URL:

```
users get --id 123
# Resolves to: GET /users/123
```

### Query Parameters

Query parameters are appended to the URL as `?key=value`:

```
items list --page 2 --limit 10
# Resolves to: GET /items?page=2&limit=10
```

### Body Parameters

Body parameters are serialized as JSON in the request body (for POST/PUT/PATCH only):

```
items create --name 'My Item' --status active
# Body: {"name": "My Item", "status": "active"}
```

### JSON-Type Parameters

Parameters of type `object` or `array` are parsed from JSON strings:

```
items create --schema '{"type":"object","properties":{"name":"string"}}'
```

The string is parsed via `JSON.parse()`. If invalid JSON, it remains a string.

### Number and Boolean Coercion

- **Number**: `--count 5` → body value `5` (Number)
- **Boolean**: `--active true` → body value `true` (Boolean)

## Debugging Tips

### Verify Spec Connectivity

If the server fails to start, verify the spec endpoint:

```bash
curl -s https://api.example.com/openapi.json | head -20
```

Check that the response is valid JSON or YAML with a `paths` section.

### Use Help to Discover Structure

Always start with `--help` to see available resources and functions. If a command fails with "Unknown resource" or "Unknown function," check the help output for valid names.

### Check Parameter Requirements

Function-level help (`<resource> <function> --help`) shows which parameters are required vs. optional.

### Inspect Error Messages

ORCa provides detailed error messages:

| Error | Meaning |
| --- | --- |
| `Unknown resource: foo` | Resource name not found in command map |
| `Unknown function bar on resource users` | Function name not found for that resource |
| `No matching path found for resource=users, function=bar` | No matching OpenAPI path for the command |
| `Missing required path parameter: id` | Required path parameter not provided |
| `Request failed: HTTP 404` | Remote service returned an error |

### Validate Auth Configuration

If requests return 401/403 errors, verify auth env vars:

```bash
echo "ORCA_AUTH_METHOD=$ORCA_AUTH_METHOD"
echo "ORCA_AUTH_BEARER_TOKEN=${ORCA_AUTH_BEARER_TOKEN:0:10}..."
```

### Test with Minimal Commands

Start with simple commands to verify connectivity:

```
users get --id 1
```

Then add complexity:

```
users get --id 1 --include profile
```

## Client Integration

### Adding ORCa to an MCP Client

1. Set `ORCA_SPEC_ENDPOINT` to the URL of the remote service's OpenAPI spec.
2. Configure the MCP client to use ORCa as an stdio server:

```json
{
  "mcp": {
    "servers": {
      "orca": {
        "command": "npx",
        "args": ["-y", "@adam-gfam/orca"],
        "env": {
          "ORCA_SPEC_ENDPOINT": "https://api.example.com/openapi.json"
        }
      }
    }
  }
}
```

### Using the command_line Tool

Once connected, use the `command_line` tool with a single string argument:

```
command_line(input="users get --id 123")
```

### Context Efficiency

The `--help` flag reduces context consumption by loading details only when needed:

1. Start with `--help` to see available resources.
2. Use `<resource> --help` to explore a resource.
3. Use `<resource> <function> --help` to learn about specific parameters.
4. Execute commands with only the parameters you need.

This is especially important for locally-hosted LLMs where context tokens are limited.

## Common Workflows

### Workflow 1: Discover and Explore

```
1. --help                    # List all resources
2. users --help              # Explore users resource
3. users get --help          # Learn about users get function
4. users get --id 1          # Execute the command
```

### Workflow 2: Create and Configure

```
1. --help                    # See available resources
2. items create --help       # Learn required params
3. items create --name 'New Item' --status draft
4. items create --id 5 --status published --force true
```

### Workflow 3: Debug a Failed Command

```
1. --help                    # Check available resources
2. <resource> --help         # Check functions
3. <resource> <func> --help  # Check parameters
4. Verify env vars: echo $ORCA_AUTH_METHOD
5. Test minimal command: <resource> <func> --<required-param> <value>
```

## Best Practices

### 1. Always Use --help First

Before executing any command, use `--help` at the appropriate level to understand available resources, functions, and parameters.

### 2. Quote Complex Values

Always quote values containing spaces, special characters, or JSON:

```
--filter '{"type":"active"}'    # Correct
--filter {"type":"active"}      # Wrong — parsed as 3 args
```

### 3. Use Boolean Flags Wisely

- `--flag true` — Explicitly include
- `--flag false` — Explicitly omit
- `--flag` — Implicitly true (no value needed)

### 4. Separate Spec and Service URLs

If the OpenAPI spec is hosted separately from the API endpoint:

```bash
export ORCA_SPEC_ENDPOINT=https://api.example.com/spec
export ORCA_SERVICE_BASE_URL=https://api.example.com
```

### 5. Monitor Context Usage

For locally-hosted LLMs, use `--help` strategically to load context only when needed. Avoid loading all tool definitions at once.

## Troubleshooting

### Server Won't Start

| Cause | Solution |
| --- | --- |
| `ORCA_SPEC_ENDPOINT` not set | Export the variable before running |
| `ORCA_SPEC_ENDPOINT` is empty | Set it to a valid URL |
| `ORCA_SPEC_ENDPOINT` is invalid URL | Check URL format (must include scheme) |
| Spec endpoint unreachable | Verify network connectivity |
| Invalid OpenAPI spec | Check that the URL returns a valid spec with `paths` |

### Commands Fail with "Unknown resource"

- Check help output for exact resource names (lowercase)
- Verify the OpenAPI spec has the expected paths
- Check that path segments are not all placeholders

### Commands Fail with "No matching path found"

- The resource and function names may not match the spec
- Check the spec's path structure and tags
- Use `--help` to see what the command map resolved

### HTTP Errors from Remote Service

- Verify authentication is configured correctly
- Check that required parameters are provided
- Inspect the remote service's API documentation
- Verify the `ORCA_SERVICE_BASE_URL` if set

### Auth Errors (401/403)

- Set `ORCA_AUTH_METHOD` to the correct method
- Provide required credentials via env vars
- Verify credentials are correct
- Check that the remote service accepts the auth method
