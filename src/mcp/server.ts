import { validateSpecEndpoint } from "../validation";

/**
 * MCP server setup — bootstraps an ORCClient from ORCA_SPEC_ENDPOINT,
 * registers the command_line tool that delegates to the remote service,
 * and starts the stdio transport.
 */
export async function startServer(): Promise<void> {
  const { McpServer } = await import("@modelcontextprotocol/server");
  const { StdioServerTransport } = await import("@modelcontextprotocol/server/stdio");
  const { z } = await import("zod");

  const endpoint = validateSpecEndpoint();

  // ────────────────────────────────────────────────────────────────
  // Initialize ORCClient — abort if connection / spec fetch fails
  // ────────────────────────────────────────────────────────────────
  const { OrcClient, OrcSpecError } = await import("../orc/client");
  const client = new OrcClient();

  try {
    await client.connect(endpoint);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`FATAL: ORCClient initialization failed — ${msg}`);
    console.error(`  Ensure ORCA_SPEC_ENDPOINT (${endpoint}) points to a valid OpenAPI spec.`);
    process.exit(1);
  }

  // ────────────────────────────────────────────────────────────────
  // Build a dynamic tool description from the fetched spec
  // ────────────────────────────────────────────────────────────────
  const specTitle = client.getSpec() && typeof client.getSpec() === "object" && client.getSpec()["info"]
    ? (client.getSpec() as any).info?.title || "ORCa Service"
    : "ORCa Service";

  const toolDescription = [
    `CLI-like tool that accepts a single string input and invokes the remote ${specTitle} service at ${endpoint}.`,
    "Parse the input as: <resource> <function> [--flag value] [--flag2]",
    "Use '--help' to generate help text for the service, a resource, or a specific function.",
    "Examples:",
    "  'users get --id 42'       → invokes GET /users/42",
    "  '--help'                  → shows all resources and usage",
    "  '--help users'            → shows functions on the users resource",
    "  '--help users get'        → shows parameters for users get",
  ].join(" ");

  const server = new McpServer(
    { name: "ORCa", version: "1.0.0" },
    { capabilities: { tools: {} } }
  );

  // ────────────────────────────────────────────────────────────────
  // Register the command_line tool
  // ────────────────────────────────────────────────────────────────
  server.registerTool(
    "command_line",
    {
      title: "Command Line",
      description: toolDescription,
      inputSchema: z.object({
        input: z.string().describe("The command input string to parse and execute."),
      }),
    },
    async ({ input }) => {
      const { parseArguments } = await import("./tools/input-parser");
      const args = parseArguments(input);

      // ── Help routing ──────────────────────────────────────────────
      if (args.length === 0 || (args.length === 1 && args[0] === "--help")) {
        // Full service help
        try {
          return {
            content: [{ type: "text" as const, text: client.help() }],
          };
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          return {
            content: [{ type: "text" as const, text: `Help error: ${msg}` }],
            isError: true,
          };
        }
      }

      // --help <resource>
      if (args[0] === "--help" && args.length === 2) {
        try {
          return {
            content: [{ type: "text" as const, text: client.helpResource(args[1]) }],
          };
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          return {
            content: [{ type: "text" as const, text: `Help error: ${msg}` }],
            isError: true,
          };
        }
      }

      // --help <resource> <function>
      if (args[0] === "--help" && args.length === 3) {
        try {
          return {
            content: [{ type: "text" as const, text: client.helpFunction(args[1], args[2]) }],
          };
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          return {
            content: [{ type: "text" as const, text: `Help error: ${msg}` }],
            isError: true,
          };
        }
      }

      // ── Normal execution ──────────────────────────────────────────
      try {
        const result = await client.exec(input);
        return {
          content: [{ type: "text" as const, text: result }],
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: "text" as const, text: msg }],
          isError: true,
        };
      }
    }
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
}
