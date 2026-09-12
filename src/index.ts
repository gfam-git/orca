// ORCa — entry point
export { validateSpecEndpoint } from "./mcp/validation";
export { parseArguments, formatArguments } from "./mcp/tools";

// Start the MCP server when run directly
const isMainModule = require.main === module;

if (isMainModule) {
  import("./mcp/server").then(({ startServer }) => {
    startServer().catch((err: Error) => {
      console.error("Server error:", err);
      process.exit(1);
    });
  });
}
