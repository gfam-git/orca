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

// ---------------------------------------------------------------------------
// Browser interaction helpers — dedicated MCP resources
// ---------------------------------------------------------------------------

const browserInteractionEndpoints: Record<
  string,
  { path: string; summary: string; description: string }
> = {
  browser_click: {
    path: "/tabs/{tabId}/click",
    summary: "Click an element",
    description:
      "Click an element in a browser tab by element ref, CSS selector, or coordinates.",
  },
  browser_type: {
    path: "/tabs/{tabId}/type",
    summary: "Type text into an element",
    description:
      "Type text into a focused element or a specific ref/selector in a browser tab.",
  },
  browser_scroll: {
    path: "/tabs/{tabId}/scroll",
    summary: "Scroll the page",
    description:
      "Scroll the page up or down by a specified number of pixels.",
  },
  browser_press: {
    path: "/tabs/{tabId}/press",
    summary: "Press a keyboard key",
    description:
      "Press a keyboard key (e.g. 'Enter', 'Escape', 'Tab') in the active browser tab.",
  },
  browser_select: {
    path: "/tabs/{tabId}/select",
    summary: "Select a form option",
    description:
      "Select a native form option by visible label or HTML value.",
  },
  browser_upload: {
    path: "/tabs/{tabId}/upload",
    summary: "Attach a file to an upload control",
    description:
      "Attach file(s) from the configured upload directory to a file input control in the browser.",
  },
  browser_wait: {
    path: "/tabs/{tabId}/wait",
    summary: "Wait for a selector or timeout",
    description:
      "Wait for a CSS selector to appear on the page or until the timeout expires.",
  },
};

/**
 * Execute a browser interaction action against the ORC client's connected service.
 * Routes through the existing OrcClient which handles the HTTP call to the OpenAPI spec endpoint.
 */
async function execBrowserInteraction(
  client: OrcClient,
  endpoint: string,
  userId: string,
  tabId: string,
  extraParams: Record<string, unknown> = {}
): Promise<string> {
  const interactInfo = browserInteractionEndpoints[endpoint];
  if (!interactInfo) {
    throw new OrcSpecError(`Unknown browser interaction endpoint: ${endpoint}`);
  }

  // Build the command string for the ORC client
  // Format: <resource> <function> --userId <userId> --tabId <tabId> [extra params]
  const resource = "tabs";
  const func = endpoint.replace("browser_", ""); // e.g., "click", "type", "scroll"

  let cmd = `${resource} ${func}`;
  cmd += ` --userId '${userId}'`;
  cmd += ` --tabId '${tabId}'`;

  // Add interaction-specific parameters
  if (endpoint === "browser_click") {
    if (extraParams.ref !== undefined) cmd += ` --ref '${extraParams.ref}'`;
    if (extraParams.selector !== undefined) cmd += ` --selector '${extraParams.selector}'`;
    if (extraParams.doubleClick === true) cmd += " --doubleClick true";
    if (extraParams.coordinates !== undefined) {
      const coords = extraParams.coordinates as { x: number; y: number };
      cmd += ` --coordinates '${JSON.stringify(coords)}'`;
    }
  } else if (endpoint === "browser_type") {
    if (extraParams.ref !== undefined) cmd += ` --ref '${extraParams.ref}'`;
    if (extraParams.selector !== undefined) cmd += ` --selector '${extraParams.selector}'`;
    if (extraParams.text !== undefined) cmd += ` --text '${extraParams.text}'`;
    if (extraParams.clear === true) cmd += " --clear true";
    if (extraParams.submit === true) cmd += " --submit true";
  } else if (endpoint === "browser_scroll") {
    if (extraParams.direction !== undefined) cmd += ` --direction '${extraParams.direction}'`;
    if (extraParams.amount !== undefined) cmd += ` --amount '${extraParams.amount}'`;
  } else if (endpoint === "browser_press") {
    if (extraParams.key !== undefined) cmd += ` --key '${extraParams.key}'`;
  } else if (endpoint === "browser_select") {
    if (extraParams.ref !== undefined) cmd += ` --ref '${extraParams.ref}'`;
    if (extraParams.selector !== undefined) cmd += ` --selector '${extraParams.selector}'`;
    if (extraParams.option !== undefined) cmd += ` --option '${extraParams.option}'`;
  } else if (endpoint === "browser_upload") {
    if (extraParams.path !== undefined) cmd += ` --path '${extraParams.path}'`;
    if (extraParams.ref !== undefined) cmd += ` --ref '${extraParams.ref}'`;
    if (extraParams.selector !== undefined) cmd += ` --selector '${extraParams.selector}'`;
    if (extraParams.timeout !== undefined) cmd += ` --timeout '${extraParams.timeout}'`;
  } else if (endpoint === "browser_wait") {
    if (extraParams.selector !== undefined) cmd += ` --selector '${extraParams.selector}'`;
    if (extraParams.timeout !== undefined) cmd += ` --timeout '${extraParams.timeout}'`;
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
 *  - registers dedicated browser interaction tools
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
  // 6. Register dedicated browser interaction tools
  // -----------------------------------------------------------------------
  for (const [toolName, interactInfo] of Object.entries(browserInteractionEndpoints)) {
    let inputSchema: any;
    let description: string;

    // Define per-tool input schemas matching the OpenAPI spec
    switch (toolName) {
      case "browser_click":
        inputSchema = z.object({
          userId: z.string().describe("User identifier"),
          tabId: z.string().describe("Tab identifier"),
          ref: z.string().optional().describe("Element ref ID (e.g. 'e3')."),
          selector: z.string().optional().describe("CSS selector fallback."),
          doubleClick: z.boolean().optional().describe("Double-click instead of single-click."),
          coordinates: z
            .object({
              x: z.number(),
              y: z.number(),
            })
            .optional()
            .describe("Click at specific coordinates."),
        });
        description = `Click an element. ${interactInfo.description}`;
        break;

      case "browser_type":
        inputSchema = z.object({
          userId: z.string().describe("User identifier"),
          tabId: z.string().describe("Tab identifier"),
          ref: z.string().optional().describe("Element ref ID."),
          selector: z.string().optional().describe("Element CSS selector."),
          text: z.string().describe("Text to type."),
          clear: z.boolean().optional().describe("Clear field before typing."),
          submit: z.boolean().optional().describe("Press Enter after typing."),
        });
        description = `Type text into an element. ${interactInfo.description}`;
        break;

      case "browser_scroll":
        inputSchema = z.object({
          userId: z.string().describe("User identifier"),
          tabId: z.string().describe("Tab identifier"),
          direction: z.enum(["up", "down", "left", "right"]).optional().describe("Scroll direction (default 'down')."),
          amount: z.number().optional().describe("Pixels to scroll."),
        });
        description = `Scroll the page. ${interactInfo.description}`;
        break;

      case "browser_press":
        inputSchema = z.object({
          userId: z.string().describe("User identifier"),
          tabId: z.string().describe("Tab identifier"),
          key: z.string().describe("Key name (e.g. 'Enter', 'Escape', 'Tab')."),
        });
        description = `Press a keyboard key. ${interactInfo.description}`;
        break;

      case "browser_select":
        inputSchema = z.object({
          userId: z.string().describe("User identifier"),
          tabId: z.string().describe("Tab identifier"),
          ref: z.string().optional().describe("Element ref ID."),
          selector: z.string().optional().describe("Element CSS selector."),
          option: z.string().describe("Visible option label or HTML value."),
        });
        description = `Select a form option. ${interactInfo.description}`;
        break;

      case "browser_upload":
        inputSchema = z.object({
          userId: z.string().describe("User identifier"),
          tabId: z.string().describe("Tab identifier"),
          path: z
            .union([z.string(), z.array(z.string())])
            .describe("Absolute path(s) to file(s) within the configured upload directory."),
          ref: z.string().optional().describe("Trigger element ref. Optional when input[type=file] already exists."),
          selector: z.string().optional().describe("Trigger element CSS selector. Optional."),
          timeout: z.number().optional().describe("Timeout in ms to wait for upload UI (default 12000)."),
        });
        description = `Attach file(s) to an upload control. ${interactInfo.description}`;
        break;

      case "browser_wait":
        inputSchema = z.object({
          userId: z.string().describe("User identifier"),
          tabId: z.string().describe("Tab identifier"),
          selector: z.string().describe("CSS selector to wait for."),
          timeout: z.number().optional().describe("Max wait time in milliseconds."),
        });
        description = `Wait for a selector to appear or timeout. ${interactInfo.description}`;
        break;

      default:
        inputSchema = z.object({
          userId: z.string().describe("User identifier"),
          tabId: z.string().describe("Tab identifier"),
        });
        description = interactInfo.description;
        break;
    }

    server.registerTool(
      toolName,
      {
        title: interactInfo.summary,
        description,
        inputSchema,
      },
      async (params: Record<string, unknown>) => {
        try {
          const extraParams: Record<string, unknown> = {};
          // Extract all params except userId and tabId
          for (const [key, value] of Object.entries(params)) {
            if (key !== "userId" && key !== "tabId") {
              extraParams[key] = value;
            }
          }
          const result = await execBrowserInteraction(client, toolName, params.userId as string, params.tabId as string, extraParams);
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
  // 7. Start listening
  // -----------------------------------------------------------------------
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
