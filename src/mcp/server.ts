import { validateSpecEndpoint } from "./validation";
import { OrcClient, OrcSpecError } from "../orc";

// ---------------------------------------------------------------------------
// Browser navigation helpers — dedicated MCP resources
// ---------------------------------------------------------------------------

const browserNavigationEndpoints: Record<
  string,
  { path: string; summary: string; description: string }
> = {
  browser_back: {
    path: "/tabs/{tabId}/back",
    summary: "Go back in browser history",
    description:
      "Navigate the active tab back in the browser history, equivalent to pressing the browser's back button.",
  },
  browser_forward: {
    path: "/tabs/{tabId}/forward",
    summary: "Go forward in browser history",
    description:
      "Navigate the active tab forward in the browser history, equivalent to pressing the browser's forward button.",
  },
  browser_refresh: {
    path: "/tabs/{tabId}/refresh",
    summary: "Refresh the current page",
    description:
      "Reload the current page in the active tab, equivalent to pressing F5 or clicking the browser's refresh button.",
  },
  browser_viewport: {
    path: "/tabs/{tabId}/viewport",
    summary: "Set page viewport size",
    description:
      "Physically resize the page viewport. Use for responsive testing — triggers a real layout reflow via Playwright's page.setViewportSize.",
  },
};

/**
 * Execute a browser navigation action against the ORC client's connected service.
 * Routes through the existing OrcClient which handles the HTTP call to the OpenAPI spec endpoint.
 */
async function execBrowserNavigation(
  client: OrcClient,
  endpoint: string,
  userId: string,
  tabId: string,
  extraParams: Record<string, unknown> = {}
): Promise<string> {
  const navInfo = browserNavigationEndpoints[endpoint];
  if (!navInfo) {
    throw new OrcSpecError(`Unknown browser navigation endpoint: ${endpoint}`);
  }

  // Build the command string for the ORC client
  // Format: <resource> <function> --userId <userId> --tabId <tabId> [extra params]
  const resource = "tabs";
  const func = endpoint.replace("browser_", ""); // e.g., "back", "forward", "refresh", "viewport"

  let cmd = `${resource} ${func}`;
  cmd += ` --userId '${userId}'`;
  cmd += ` --tabId '${tabId}'`;

  // Add viewport dimensions if applicable
  if (endpoint === "browser_viewport") {
    if (extraParams.width !== undefined) {
      cmd += ` --width '${extraParams.width}'`;
    }
    if (extraParams.height !== undefined) {
      cmd += ` --height '${extraParams.height}'`;
    }
  }

  return client.exec(cmd);
}

/**
 * MCP server setup — only runs when this file is executed directly.
 * Wires ORCClient into the server lifecycle:
 *  - validates the ORCA_SPEC_ENDPOINT
 *  - connects to the remote OpenAPI spec
 *  - builds the command map
 *  - registers tools that route through the ORCClient
 *  - registers dedicated browser navigation tools
 *  - fails fast on any initialization error
 */
export async function startServer(): Promise<void> {
  const { McpServer } = await import("@modelcontextprotocol/server");
  const { StdioServerTransport } = await import("@modelcontextprotocol/server/stdio");
  const { z } = await import("zod");

  // -----------------------------------------------------------------------
  // 1. Validate the spec endpoint (exits on invalid / empty / missing)
  // -----------------------------------------------------------------------
  const endpoint = validateSpecEndpoint();

  // -----------------------------------------------------------------------
  // 2. Instantiate and connect ORCClient — fails fast on any init error
  // -----------------------------------------------------------------------
  let client: OrcClient;

  try {
    client = new OrcClient();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("ERROR: Failed to instantiate OrcClient:", message);
    console.error("  Check that src/orc/client.ts exports a valid OrcClient class.");
    process.exit(1);
  }

  try {
    await client.connect(endpoint);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    // Distinguish spec-fetch failures from command-map-building failures
    if (err instanceof OrcSpecError) {
      console.error("ERROR: ORCClient initialization failed — invalid or unreachable spec:");
      console.error(`  ${message}`);
      console.error("  Ensure ORCA_SPEC_ENDPOINT points to a valid, reachable OpenAPI spec URL.");
    } else {
      console.error("ERROR: ORCClient failed to connect to the remote service:");
      console.error(`  ${message}`);
      console.error("  Check network connectivity and that the endpoint is running.");
    }

    process.exit(1);
  }

  // At this point the client is connected, spec is loaded, and commandMap is built.

  // -----------------------------------------------------------------------
  // 3. Build the MCP server
  // -----------------------------------------------------------------------
  const server = new McpServer(
    { name: "ORCa", version: "1.0.0" },
    { capabilities: { tools: {} } }
  );

  // -----------------------------------------------------------------------
  // 4. Register the command_line tool — routes through ORCClient
  // -----------------------------------------------------------------------
  server.registerTool(
    "command_line",
    {
      title: "Command Line",
      description:
        "CLI-like tool that accepts a single string input, parses it, and routes it through the connected OpenAPI service. Use --help to see available resources and functions.",
      inputSchema: z.object({
        input: z.string().describe("The command input string to execute or get help for."),
      }),
    },
    async ({ input }) => {
      // Handle --help variants
      if (input.trim() === "--help" || input.trim() === "-h" || input.trim() === "help") {
        try {
          const helpText = client.help();
          return {
            content: [{ type: "text" as const, text: helpText }],
          };
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          return {
            content: [{ type: "text" as const, text: `Help error: ${message}` }],
          };
        }
      }

      // Check for resource-level help: "resource --help"
      const parts = input.trim().split(/\s+/);
      if (parts.length === 2 && (parts[1] === "--help" || parts[1] === "-h" || parts[1] === "help")) {
        try {
          const helpText = client.helpResource(parts[0]);
          return {
            content: [{ type: "text" as const, text: helpText }],
          };
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          return {
            content: [{ type: "text" as const, text: `Help error: ${message}` }],
          };
        }
      }

      // Check for function-level help: "resource func --help"
      if (parts.length === 3 && (parts[2] === "--help" || parts[2] === "-h" || parts[2] === "help")) {
        try {
          const helpText = client.helpFunction(parts[0], parts[1]);
          return {
            content: [{ type: "text" as const, text: helpText }],
          };
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          return {
            content: [{ type: "text" as const, text: `Help error: ${message}` }],
          };
        }
      }

      // Execute the command through the ORCClient
      try {
        const result = await client.exec(input);
        return {
          content: [{ type: "text" as const, text: result }],
        };
      } catch (err) {
        const message = err instanceof OrcSpecError ? err.message : String(err);
        return {
          content: [{ type: "text" as const, text: `Error: ${message}` }],
          isError: true,
        };
      }
    }
  );

  // -----------------------------------------------------------------------
  // 5. Register dedicated browser navigation tools
  // -----------------------------------------------------------------------
  for (const [toolName, navInfo] of Object.entries(browserNavigationEndpoints)) {
    let inputSchema: any;
    let description: string;

    if (toolName === "browser_viewport") {
      inputSchema = z.object({
        userId: z.string().describe("User identifier"),
        tabId: z.string().describe("Tab identifier"),
        width: z.number().optional().describe("Viewport width in pixels"),
        height: z.number().optional().describe("Viewport height in pixels"),
      });
      description = `Set page viewport size. ${navInfo.description}`;
    } else {
      inputSchema = z.object({
        userId: z.string().describe("User identifier"),
        tabId: z.string().describe("Tab identifier"),
      });
      description = navInfo.description;
    }

    server.registerTool(
      toolName,
      {
        title: navInfo.summary,
        description,
        inputSchema,
      },
      async ({ userId, tabId, width, height }: { userId: string; tabId: string; width?: number; height?: number }) => {
        const extraParams: Record<string, unknown> = {};
        if (toolName === "browser_viewport") {
          if (width !== undefined) extraParams.width = width;
          if (height !== undefined) extraParams.height = height;
        }
        try {
          const result = await execBrowserNavigation(client, toolName, userId, tabId, extraParams);
          return {
            content: [{ type: "text" as const, text: result }],
          };
        } catch (err) {
          const message = err instanceof OrcSpecError ? err.message : String(err);
          return {
            content: [{ type: "text" as const, text: `Error: ${message}` }],
            isError: true,
          };
        }
      }
    );
  }

  // -----------------------------------------------------------------------
  // 6. Start listening
  // -----------------------------------------------------------------------
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
