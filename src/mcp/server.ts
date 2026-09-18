import { validateSpecEndpoint, validateServiceEndpoint } from "./validation";
import { OrcClient, OrcSpecError } from "../orc";

// ---------------------------------------------------------------------------
// Content extraction helpers — dedicated MCP resources
// ---------------------------------------------------------------------------

const contentExtractionEndpoints: Record<
  string,
  { path: string; summary: string; description: string }
> = {
  browser_links: {
    path: "/tabs/{tabId}/links",
    summary: "Extract page links",
    description:
      "Extract all hyperlinks from the current page, returning text, href, and element ref for each link.",
  },
  browser_downloads: {
    path: "/tabs/{tabId}/downloads",
    summary: "List tab downloads",
    description:
      "List all file downloads associated with the current tab, including filename, URL, and download state.",
  },
  browser_images: {
    path: "/tabs/{tabId}/images",
    summary: "Extract page images",
    description:
      "Extract all images from the current page, returning src, alt text, and dimensions for each image.",
  },
  browser_stats: {
    path: "/tabs/{tabId}/stats",
    summary: "Get tab statistics",
    description:
      "Retrieve tab metadata including URL, tool call count, visited URLs, download count, and consecutive failure count.",
  },
  browser_screenshot: {
    path: "/tabs/{tabId}/screenshot",
    summary: "Take a screenshot",
    description:
      "Capture a base64-encoded PNG screenshot of the current page viewport.",
  },
};

/**
 * Execute a content extraction action against the ORC client's connected service.
 * Routes through the existing OrcClient which handles the HTTP call to the OpenAPI spec endpoint.
 */
async function execContentExtraction(
  client: OrcClient,
  endpoint: string,
  userId: string,
  tabId: string
): Promise<string> {
  const extractInfo = contentExtractionEndpoints[endpoint];
  if (!extractInfo) {
    throw new OrcSpecError(`Unknown content extraction endpoint: ${endpoint}`);
  }

  // Build the command string for the ORC client
  // Format: <resource> <function> --userId <userId> --tabId <tabId>
  const resource = "tabs";
  const func = endpoint.replace("browser_", ""); // e.g., "links", "downloads", "images", "stats", "screenshot"

  let cmd = `${resource} ${func}`;
  cmd += ` --userId '${userId}'`;
  cmd += ` --tabId '${tabId}'`;

  return client.exec(cmd);
}

/**
 * MCP server setup — only runs when this file is executed directly.
 * Wires ORCClient into the server lifecycle:
 *  - validates the ORCA_SPEC_ENDPOINT
 *  - connects to the remote OpenAPI spec
 *  - builds the command map
 *  - registers tools that route through the ORCClient
 *  - registers dedicated content extraction tools
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
  // 1b. Validate the service base URL (falls back to spec endpoint)
  // -----------------------------------------------------------------------
  const serviceUrl = validateServiceEndpoint(endpoint);

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
    await client.connect(endpoint, serviceUrl);
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
  // 5. Register dedicated content extraction tools
  // -----------------------------------------------------------------------
  for (const [toolName, extractInfo] of Object.entries(contentExtractionEndpoints)) {
    let inputSchema: any;
    let description: string;

    // Define per-tool input schemas
    switch (toolName) {
      case "browser_links":
        inputSchema = z.object({
          userId: z.string().describe("User identifier"),
          tabId: z.string().describe("Tab identifier"),
        });
        description = `Extract all hyperlinks from the current page. ${extractInfo.description}`;
        break;

      case "browser_downloads":
        inputSchema = z.object({
          userId: z.string().describe("User identifier"),
          tabId: z.string().describe("Tab identifier"),
        });
        description = `List all file downloads associated with the current tab. ${extractInfo.description}`;
        break;

      case "browser_images":
        inputSchema = z.object({
          userId: z.string().describe("User identifier"),
          tabId: z.string().describe("Tab identifier"),
        });
        description = `Extract all images from the current page. ${extractInfo.description}`;
        break;

      case "browser_stats":
        inputSchema = z.object({
          userId: z.string().describe("User identifier"),
          tabId: z.string().describe("Tab identifier"),
        });
        description = `Retrieve tab metadata including URL, tool call count, visited URLs, download count, and consecutive failure count. ${extractInfo.description}`;
        break;

      case "browser_screenshot":
        inputSchema = z.object({
          userId: z.string().describe("User identifier"),
          tabId: z.string().describe("Tab identifier"),
        });
        description = `Capture a base64-encoded PNG screenshot of the current page viewport. ${extractInfo.description}`;
        break;

      default:
        inputSchema = z.object({
          userId: z.string().describe("User identifier"),
          tabId: z.string().describe("Tab identifier"),
        });
        description = extractInfo.description;
        break;
    }

    server.registerTool(
      toolName,
      {
        title: extractInfo.summary,
        description,
        inputSchema,
      },
      async ({ userId, tabId }: { userId: string; tabId: string }) => {
        try {
          const result = await execContentExtraction(client, toolName, userId, tabId);
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
