// ---------------------------------------------------------------------------
// ORCClient types — command map, parameters, and client interface
// ---------------------------------------------------------------------------

// OpenAPI spec types (minimal, for parsing)

export interface OpenApiSpec {
  openapi?: string;
  info?: { title?: string; description?: string };
  servers?: { url?: string }[];
  paths?: Record<string, Record<string, OpenApiOperation>>;
  components?: { schemas?: Record<string, OpenApiSchema> };
}

interface OpenApiOperation {
  tags?: string[];
  operationId?: string;
  summary?: string;
  description?: string;
  parameters?: OpenApiParam[];
  requestBody?: OpenApiRequestBody;
  responses?: Record<string, OpenApiResponseBody>;
  "x-method-type"?: string;
}

interface OpenApiParam {
  name?: string;
  in?: "query" | "path" | "header" | "body";
  schema?: OpenApiSchema;
  required?: boolean;
  description?: string;
}

interface OpenApiRequestBody {
  content?: Record<string, { schema?: OpenApiSchema }>;
  required?: boolean;
}

interface OpenApiResponseBody {
  description?: string;
  content?: Record<string, unknown>;
}

interface OpenApiSchema {
  type?: string;
  properties?: Record<string, OpenApiSchema>;
  required?: string[];
  items?: OpenApiSchema;
  format?: string;
  enum?: unknown[];
  description?: string;
}

/** A parameter definition extracted from an OpenAPI operation. */
export interface ParamDef {
  /** Parameter name (e.g. "groupName", "debug") */
  name: string;
  /** Parameter type string (e.g. "string", "boolean", "integer") */
  type: string;
  /** Parameter description from the spec, if any */
  description?: string;
  /** Whether this parameter is required */
  required: boolean;
  /** Whether this is a boolean parameter */
  boolean: boolean;
  /** Where this parameter lives in the HTTP request */
  location: "query" | "path" | "body";
}

/** A function (operation) on a resource. */
export interface FuncDef {
  /** Function name (e.g. "get", "post", "delete") */
  name: string;
  /** Function description from the spec, if any */
  description?: string;
  /** Parameter definitions for this function */
  params: ParamDef[];
}

/** A resource (path group) containing functions. */
export interface ResourceDef {
  /** Resource name (e.g. "users", "tabs", "items") */
  name: string;
  /** Resource description from the spec, if any */
  description?: string;
  /** Function definitions for this resource */
  functions: Record<string, FuncDef>;
}

/** The full command map: resource name -> resource definition. */
export type CommandMap = Record<string, ResourceDef>;

/** An OpenAPI operation resolved into a concrete path and method. */
export interface ResolvedOperation {
  /** Absolute path with placeholders replaced (e.g. "/users/123") */
  path: string;
  /** HTTP method (e.g. "GET", "POST") */
  method: string;
  /** Body to send for POST/PUT/PATCH, or null for GET/DELETE */
  body: Record<string, unknown> | null;
  /** Query parameters to append */
  query: Record<string, string | number | boolean>;
  /** Original path template for help text */
  pathTemplate: string;
  /** Original operation summary/description */
  summary: string;
  /** Original operation description */
  description: string;
}

/**
 * The public interface for the ORC client.
 * All ORC functionality lives on this single exported type.
 */
export interface ORCClient {
  /** Whether the client has successfully connected and loaded a spec */
  isConnected: boolean;
  /** The URL the client is connected to (set after connect) */
  url: string;
  /** The raw OpenAPI spec object (parsed) */
  spec: unknown;
  /** The parsed command map */
  commandMap: CommandMap;

  /**
   * Connect to a remote service, fetch its OpenAPI spec, and parse it.
   * @param url The URL of the remote service's OpenAPI endpoint.
   */
  connect(url: string): Promise<void>;

  /** Disconnect and clear internal state. */
  disconnect(): void;

  /**
   * Get the OpenAPI spec as a JSON string.
   */
  getSpecJson(): string;

  /**
   * Get the parsed OpenAPI spec object.
   */
  getSpec(): unknown;

  /**
   * Generate help text for the entire service (lists all resources).
   */
  help(): string;

  /**
   * Generate help text for a specific resource.
   * @param resource Resource name.
   */
  helpResource(resource: string): string;

  /**
   * Generate help text for a specific function on a resource.
   * @param resource Resource name.
   * @param func Function name.
   */
  helpFunction(resource: string, func: string): string;

  /**
   * Execute a command string against the remote service.
   * Parses the command, routes to the appropriate operation, and returns the result.
   * @param command The command string (e.g. "users get --id 123").
   * @returns The response body as a JSON string.
   */
  exec(command: string): Promise<string>;

  /**
   * Parse a command string into its components (resource, function, flags).
   * @param command The command string.
   * @returns Parsed command components.
   */
  parseCommand(command: string): ParsedCommand;
}

/** Parsed command components. */
export interface ParsedCommand {
  resource: string;
  func: string;
  flags: Record<string, string | boolean>;
}
