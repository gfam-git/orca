import { validateSpecEndpoint } from "../validation";

/**
 * MCP server setup — only runs when this file is executed directly.
 */
export async function startServer(): Promise<void> {
  const { McpServer } = await import("@modelcontextprotocol/server");
  const { StdioServerTransport } = await import("@modelcontextprotocol/server/stdio");
  const { z } = await import("zod");

  const endpoint = validateSpecEndpoint();

  const server = new McpServer(
    { name: "ORCa", version: "1.0.0" },
    { capabilities: { tools: {} } }
  );

  // Register the command_line tool
  server.registerTool(
    "command_line",
    {
      title: "Command Line",
      description:
        "CLI-like tool that accepts a single string input and parses it into arguments.",
      inputSchema: z.object({
        input: z.string().describe("The command input string to parse."),
      }),
    },
    async ({ input }) => {
      const { parseArguments, formatArguments } = await import("./tools/index");
      const args = parseArguments(input);
      const output = formatArguments(args);
      return {
        content: [{ type: "text" as const, text: output }],
      };
    }
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
}
