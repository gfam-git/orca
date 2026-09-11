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

Once configured, interact with ORCa through your MCP client's tool interface. Pass a single string argument containing the command and any parameters. ORCa will parse the input, route it to the appropriate OpenAPI operation, and return the result.

Use `--help` to generate help text for available resources, functions, and inputs based on the remote service's OpenAPI spec.
