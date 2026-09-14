// ---------------------------------------------------------------------------
// ORC Modules — Barrel Export
// ---------------------------------------------------------------------------
// Re-export all ORC types, utilities, and the OrcClient from a single entry
// point so consumers can import everything from @adam-gfam/orca/orc.
// ---------------------------------------------------------------------------

export * from "./types";
export {
  OrcSpecError,
  buildCommandMap,
  parseCommand,
  resolveOperation,
  help,
  helpResource,
  helpFunction,
  OrcClient,
} from "./client";
