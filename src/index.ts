// ---------------------------------------------------------------------------
// ORCA_SPEC_ENDPOINT validation
// ---------------------------------------------------------------------------

export function validateSpecEndpoint(): string {
  const endpoint = process.env.ORCA_SPEC_ENDPOINT;

  if (!endpoint) {
    console.error("ERROR: ORCA_SPEC_ENDPOINT is not set.");
    console.error("  Set it to the URL of a remote service exposing an OpenAPI spec.");
    process.exit(1);
  }

  if (endpoint.trim() === "") {
    console.error("ERROR: ORCA_SPEC_ENDPOINT is empty.");
    console.error("  Set it to the URL of a remote service exposing an OpenAPI spec.");
    process.exit(1);
  }

  try {
    new URL(endpoint);
  } catch {
    console.error(`ERROR: ORCA_SPEC_ENDPOINT is not a valid URL: ${endpoint}`);
    console.error("  Set it to the URL of a remote service exposing an OpenAPI spec.");
    process.exit(1);
  }

  return endpoint;
}

// ---------------------------------------------------------------------------
// CLI argument parser (whitespace-split, quote-aware)
// ---------------------------------------------------------------------------

/**
 * Parse a single-string CLI input into an array of arguments.
 *
 * - Splits on whitespace, except when characters are wrapped in matching
 *   single (`'`) or double (`"`) quotes.
 * - Quote characters are preserved in the output (they are part of the arg).
 * - Handles escaped quotes inside quoted strings (`\"` and `\'`).
 *
 * @param input The raw command string supplied by the user.
 * @returns An array of parsed argument strings.
 */
export function parseArguments(input: string): string[] {
  const args: string[] = [];
  let current = "";
  let inQuote: string | null = null;
  let escaped = false;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];

    if (escaped) {
      current += ch;
      escaped = false;
      continue;
    }

    if (ch === "\\") {
      current += ch;
      escaped = true;
      continue;
    }

    if (inQuote !== null && ch === inQuote) {
      inQuote = null;
      continue;
    }

    if ((ch === '"' || ch === "'") && inQuote === null) {
      inQuote = ch;
      continue;
    }

    if (ch === " " || ch === "\t" || ch === "\n" || ch === "\r") {
      if (inQuote !== null) {
        current += ch;
      } else if (current.length > 0) {
        args.push(current);
        current = "";
      }
      continue;
    }

    current += ch;
  }

  if (current.length > 0) {
    args.push(current);
  }

  return args;
}

// ---------------------------------------------------------------------------
// Placeholder logic — pretty-print parsed arguments
// ---------------------------------------------------------------------------

/**
 * Output a pretty, stringified list of the parsed arguments.
 *
 * Each argument is printed on its own line, prefixed with an index
 * and wrapped in single quotes so the output is immediately readable.
 *
 * @param args The parsed argument list.
 * @returns A multi-line string suitable for display.
 */
export function formatArguments(args: string[]): string {
  if (args.length === 0) {
    return "No arguments provided.";
  }

  const lines: string[] = args.map(
    (arg, idx) => `  [${String(idx).padStart(2, " ")}] '${arg}'`
  );

  const header = `Arguments (${args.length}):`;
  return `${header}\n${lines.join("\n")}`;
}

// ---------------------------------------------------------------------------
// MCP server setup — only runs when this file is executed directly
// ---------------------------------------------------------------------------

async function startServer(): Promise<void> {
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

const isMainModule = require.main === module;

if (isMainModule) {
  startServer().catch((err) => {
    console.error("Server error:", err);
    process.exit(1);
  });
}
