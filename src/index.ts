// ORCa — entry point
export { validateSpecEndpoint } from "./mcp/validation";
export { parseArguments, formatArguments } from "./mcp/tools";

// ORC modules — re-export for top-level package usage
export {
  OrcClient,
  OrcSpecError,
  buildCommandMap,
  parseCommand,
  resolveOperation,
  help,
  helpResource,
  helpFunction,
} from "./orc/client";
export type {
  ParamDef,
  FuncDef,
  ResourceDef,
  CommandMap,
  ResolvedOperation,
  ORCClient,
  ParsedCommand,
} from "./orc/types";

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
