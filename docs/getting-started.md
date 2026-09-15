# ORCa — Getting Started

## Prerequisites

- Node.js (LTS version)
- npm

## Installation

Add ORCa as an MCP server to any MCP client. The exact steps depend on the client you are using.

### Hermes Agent (Dashboard)

1. Log into Hermes.
2. Navigate to **MCP** and click **Add Server**.
3. Set the following fields:
   - **Name**: Any name you want (e.g., `web-browser-orca`).
   - **Transport**: `stdio`
   - **Command**: `npx`
   - **Args**: `-y @adam-gfam/orca`
   - **Environment**:
     ```
     ORCA_SPEC_ENDPOINT=https://remote.service.example.tld/api
     ```

### From Source

```bash
npx -y @adam-gfam/orca
```

Set `ORCA_SPEC_ENDPOINT` in your environment before running.

## Configuration

The only required configuration is the `ORCA_SPEC_ENDPOINT` environment variable, which must point to the URL of the remote service endpoint serving the OpenAPI spec.

## Usage

Once configured, interact with ORCa through your MCP client's tool interface. Pass a single string argument containing the command and any parameters. ORCa will parse the input, resolve it against the fetched OpenAPI spec, and execute the request against the remote service.

### Command Syntax

```
<resource> <function> [--flag value] [--flag2]
```

### Help Commands

Use `--help` to generate help text from the fetched OpenAPI spec:

| Input | Description |
| --- | --- |
| `'--help'` | Show all resources and general usage |
| `'--help <resource>'` | Show functions available on a resource |
| `'--help <resource> <function>'` | Show parameters and examples for a function |

### Example Commands

```
--help
--help users
--help users get --id 42
users get --id 42
users create --name "John Doe" --email "john@example.com"
```

## How It Works

1. The server starts and validates `ORCA_SPEC_ENDPOINT`.
2. `OrcClient.connect(endpoint)` fetches the OpenAPI spec and builds a command map.
3. The `command_line` tool receives input, parses it, and delegates to `client.exec()`.
4. For `--help` commands, the client generates help text from the command map.
5. For normal commands, the client resolves the command to an HTTP request and returns the response.

## Error Handling

The server will abort with exit code 1 if:

1. `ORCA_SPEC_ENDPOINT` is not set, empty, or not a valid URL.
2. The `OrcClient` cannot fetch or parse the OpenAPI spec from the endpoint.

Command execution errors are returned as error responses from the `command_line` tool rather than aborting the server.
