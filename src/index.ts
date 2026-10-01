#!/usr/bin/env node
// ORCa — entry point
export { validateSpecEndpoint, validateServiceEndpoint } from "./mcp/validation.js";
export { parseArguments, formatArguments } from "./mcp/tools/index.js";

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
  extractServerUrl,
} from "./orc/client.js";
export {
  parseAuthConfig,
  injectAuthHeaders,
  injectApiKeyQuery,
} from "./orc/auth.js";
export type {
  ParamDef,
  FuncDef,
  ResourceDef,
  CommandMap,
  ResolvedOperation,
  ORCClient,
  ParsedCommand,
  AuthConfig,
  AuthMethod,
  SecurityScheme,
} from "./orc/types.js";

// Start the MCP server when run directly
const isMainModule = process.argv[1] && (import.meta.url === new URL(import.meta.resolve(process.argv[1])).href);

if (isMainModule) {
  import("./mcp/server.js").then(({ startServer }) => {
    startServer().catch((err: Error) => {
      console.error("Server error:", err);
      process.exit(1);
    });
  });
}
