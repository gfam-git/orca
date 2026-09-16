// ---------------------------------------------------------------------------
// ORCClient — OpenAPI as Remote CLI client
// ---------------------------------------------------------------------------

import { request } from "undici";
import {
  ParamDef,
  FuncDef,
  CommandMap,
  ResolvedOperation,
  ORCClient,
  ParsedCommand,
} from "./types";

// ---------------------------------------------------------------------------
// OpenAPI spec types (minimal, for parsing)
// ---------------------------------------------------------------------------

interface OpenApiSpec {
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

// ---------------------------------------------------------------------------
// YAML parser (lightweight — handles the specs we need)
// ---------------------------------------------------------------------------

/**
 * Minimal YAML parser for OpenAPI specs.
 * Handles the subset of YAML needed for OpenAPI path parameters,
 * schemas, and operation metadata.
 */
function parseYaml(text: string): unknown {
  try {
    // Try native JSON parse first (some specs are JSON)
    return JSON.parse(text);
  } catch {
    // Fall back to simple YAML parsing
    return parseSimpleYaml(text);
  }
}

function parseSimpleYaml(text: string): unknown {
  // Split into lines and parse key-value pairs
  const lines = text.split("\n");
  const root: Record<string, unknown> = {};
  let currentObj: Record<string, unknown> = root;
  let parentStack: { key: string; obj: Record<string, unknown>; indent: number }[] = [];

  for (const line of lines) {
    // Skip empty lines and comments
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const indent = line.search(/[^ ]/);
    const colonPos = trimmed.indexOf(":");
    if (colonPos === -1) continue;

    const key = trimmed.substring(0, colonPos).trim();
    const value = trimmed.substring(colonPos + 1).trim();

    // Handle list items
    if (value.startsWith("- ")) {
      const listValue = value.substring(2).trim();
      if (key && !Array.isArray(currentObj[key])) {
        currentObj[key] = [listValue];
      } else if (Array.isArray(currentObj[key])) {
        (currentObj[key] as string[]).push(listValue);
      }
      continue;
    }

    // Handle nested objects (indented keys)
    if (indent > 0 && parentStack.length > 0) {
      // Find the right parent
      while (parentStack.length > 0 && parentStack[parentStack.length - 1].indent >= indent) {
        parentStack.pop();
      }
      if (parentStack.length > 0) {
        const parent = parentStack[parentStack.length - 1];
        const newObj: Record<string, unknown> = {};
        parent.obj[parent.key] = newObj;
        currentObj = newObj;
        parentStack.push({ key: key, obj: newObj, indent: indent });
      } else {
        const newObj: Record<string, unknown> = {};
        currentObj[key] = newObj;
        currentObj = newObj;
      }
    } else {
      // Top-level key
      const newObj: Record<string, unknown> = {};
      currentObj[key] = newObj;
      currentObj = newObj;
      parentStack.push({ key, obj: currentObj, indent: 0 });
    }

    // Handle scalar values
    if (value && !value.startsWith("{") && !value.startsWith("[")) {
      // Check if this is a simple value or start of a nested object
      const nextLine = lines[lines.indexOf(trimmed) + 1];
      if (nextLine && nextLine.search(/[^ ]/) > indent) {
        // This key starts a nested object — already handled above
      } else if (value) {
        // Simple scalar value
        const parent = parentStack[parentStack.length - 1];
        if (parent) {
          parent.obj[parent.key] = coerceValue(value);
        }
      }
    }
  }

  return root;
}

function coerceValue(val: string): string | number | boolean {
  if (val === "true") return true;
  if (val === "false") return false;
  if (!isNaN(Number(val))) return Number(val);
  return val;
}

// ---------------------------------------------------------------------------
// OpenAPI spec validation
// ---------------------------------------------------------------------------

/** Custom error class for ORC spec-related failures */
export class OrcSpecError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OrcSpecError";
  }
}

/**
 * Validate that the fetched content is a valid OpenAPI spec.
 * @param content The fetched spec content (JSON or YAML).
 * @returns Parsed spec object.
 */
function validateSpec(content: string): OpenApiSpec {
  let parsed: unknown;

  // Try JSON first
  try {
    parsed = JSON.parse(content);
  } catch {
    // Try YAML
    parsed = parseYaml(content);
  }

  const spec = parsed as OpenApiSpec;

  // Basic OpenAPI validation
  if (!spec.paths || typeof spec.paths !== "object" || Object.keys(spec.paths).length === 0) {
    throw new OrcSpecError(
      "Invalid OpenAPI spec: no 'paths' section found. Ensure the URL points to a valid OpenAPI document."
    );
  }

  return spec;
}

// ---------------------------------------------------------------------------
// Command map builder — transforms OpenAPI spec into Resource -> Function -> Params
// ---------------------------------------------------------------------------

/**
 * Build the command map from an OpenAPI spec.
 *
 * Mapping rules:
 * - Path segments become resource names (first segment) and function names (second segment).
 * - For paths like /{resource}/{id}, the resource is the first path group.
 * - HTTP methods become function names (get, post, put, patch, delete, etc.).
 * - If the function name matches the resource name, use the method type (e.g. "item get").
 * - Parameters become flags with --name value format.
 * - Boolean parameters: omit value if true, omit flag if false.
 */
export function buildCommandMap(spec: OpenApiSpec): CommandMap {
  const commandMap: CommandMap = {};
  const paths = spec.paths || {};

  for (const [pathTemplate, methods] of Object.entries(paths)) {
    for (const [method, operation] of Object.entries(methods)) {
      if (!isHttpMethod(method)) continue;

      // const tags = operation.tags || [];
      // const operationId = operation.operationId || "";

      // Determine resource and function name
      const { resource, func } = resolveResourceAndFunction(pathTemplate, method/*, tags, operationId*/);

      // Build function definition
      const funcDef: FuncDef = {
        name: func,
        description: operation.summary || operation.description,
        params: buildParamDefs(operation, pathTemplate),
      };

      // Add to resource
      if (!commandMap[resource]) {
        commandMap[resource] = {
          name: resource,
          description: getResourceDescription(spec, resource),
          functions: {},
        };
      }

      commandMap[resource].functions[func] = funcDef;
    }
  }

  return commandMap;
}

/** Check if a string is a valid HTTP method */
function isHttpMethod(method: string): boolean {
  const methods = ["get", "post", "put", "patch", "delete", "head", "options", "connect", "trace"];
  return methods.includes(method.toLowerCase());
}

/**
 * Resolve resource and function names from path, method, tags, and operationId.
 */
function resolveResourceAndFunction(
  pathTemplate: string,
  method: string,
  // tags: string[],
  // operationId: string
): { resource: string; func: string } {
  // Try tags first (most common convention)
  // if (tags.length > 0) {
  //   const resource = tags[0].toLowerCase();
  //   // Try to derive function from operationId
  //   // const func = deriveFunctionName(operationId, method, resource);
  //   // return { resource, func };
  // }

  // Fall back to path-based resolution
  // Normalize path: remove leading slash, split by /
  const segments = pathTemplate
    .replace(/{.*}\//, "")
    .split("/")
    .filter((s) => s.length > 0);

  if (segments.length >= 2) {
    const resource = segments[0].toLowerCase();
    const secondSegment = segments[1].toLowerCase();

    // Check if second segment is a method name, matches the resource, or is a path placeholder
    const methodLower = method.toLowerCase();
    if (secondSegment === methodLower || secondSegment === resource || secondSegment.startsWith("{")) {
      // Use method as function name
      return { resource, func: methodLower };
    }

    // Use second segment as function name
    return { resource, func: secondSegment };
  }

  // Single segment path: resource is the segment, function is the method
  if (segments.length === 1) {
    return { resource: segments[0].toLowerCase(), func: method.toLowerCase() };
  }

  // Default
  return { resource: "default", func: method.toLowerCase() };
}

/** Derive function name from operationId, method, and resource */
function deriveFunctionName(
  operationId: string,
  method: string,
  resource: string
): string {
  if (!operationId) return method.toLowerCase();

  // Try to extract action from operationId (e.g. "getUser" -> "get", "createUser" -> "create")
  const methodLower = method.toLowerCase();

  // If operationId starts with the resource name, use the method
  if (operationId.toLowerCase().startsWith(resource)) {
    return methodLower;
  }

  // If operationId contains a method-like prefix, extract it
  const prefixes = ["get", "post", "put", "patch", "delete", "create", "update", "list", "search"];
  for (const prefix of prefixes) {
    if (operationId.toLowerCase().startsWith(prefix)) {
      return prefix;
    }
  }

  // Default: use method
  return methodLower;
}

/** Get resource description from spec components or paths */
function getResourceDescription(spec: OpenApiSpec, resource: string): string | undefined {
  // Check paths for resource-specific descriptions
  const paths = spec.paths || {};
  for (const [_path, _methods] of Object.entries(paths)) {
    if (_path.split('/').length > 2) {continue;}
    for (const [_method, operation] of Object.entries(_methods)) {
      const tags = operation.tags || [];
      if (tags[0]?.toLowerCase() === resource) {
        if (operation.summary) return operation.summary;
        if (operation.description) return operation.description;
      }
    }
  }

  return undefined;
}

/** Build parameter definitions from an OpenAPI operation */
function buildParamDefs(operation: OpenApiOperation, pathTemplate: string): ParamDef[] {
  const params: ParamDef[] = [];

  // Collect path parameters from the path template
  const pathSegments = pathTemplate.replace(/^\//, "").split("/");
  const pathParamNames: string[] = [];

  for (const segment of pathSegments) {
    if (segment.startsWith("{") && segment.endsWith("}")) {
      pathParamNames.push(segment.slice(1, -1));
    }
  }

  // Process operation-level parameters
  const operationParams = operation.parameters || [];
  for (const param of operationParams) {
    if (!param.name) continue;

    const schema = param.schema || {};
    const paramType = schema.type || "string";
    const location = (param.in || "query") as "query" | "path" | "body";
    const isBoolean = paramType === "boolean";

    params.push({
      name: param.name,
      type: paramType,
      description: param.description,
      required: param.required === true,
      boolean: isBoolean,
      location,
    });
  }

  // Add path parameters from template that aren't already in the spec params
  for (const name of pathParamNames) {
    const existing = params.find((p) => p.name === name);
    if (!existing) {
      params.push({
        name,
        type: "string",
        required: true,
        boolean: false,
        location: "path",
      });
    }
  }

  // Process request body parameters
  if (operation.requestBody) {
    const content = operation.requestBody.content;
    if (content) {
      for (const [contentType, bodyDef] of Object.entries(content)) {
        if (contentType === "application/json" || contentType === "application/x-www-form-urlencoded") {
          const schema = bodyDef.schema;
          if (schema?.properties) {
            const required = schema.required || [];
            for (const [propName, propSchema] of Object.entries(schema.properties)) {
              const existing = params.find((p) => p.name === propName);
              if (!existing) {
                params.push({
                  name: propName,
                  type: propSchema.type || "string",
                  description: propSchema.description,
                  required: required.includes(propName),
                  boolean: propSchema.type === "boolean",
                  location: "body",
                });
              }
            }
          }
        }
      }
    }
  }

  return params;
}

// ---------------------------------------------------------------------------
// Command parser — converts string array to command components
// ---------------------------------------------------------------------------

/**
 * Parse a command string into its components (resource, function, flags).
 * Format: resource function [--flag value] [--flag2]
 * Boolean flags: --flag true === --flag, --flag false === omit flag
 */
export function parseCommand(command: string): ParsedCommand {
  // Split on whitespace, preserving quoted strings
  const args: string[] = [];
  let current = "";
  let inQuote: string | null = null;
  let escaped = false;

  for (let i = 0; i < command.length; i++) {
    const ch = command[i];

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

  // Parse: first arg = resource, second arg = function, rest = flags
  const resource = args[0] || "";
  const func = args[1] || "";
  const flags: Record<string, string | boolean> = {};

  let i = 2;
  while (i < args.length) {
    const arg = args[i];

    if (arg.startsWith("--")) {
      const flagName = arg.substring(2);

      // Check if next arg is a value
      const nextArg = args[i + 1];
      if (nextArg && !nextArg.startsWith("--")) {
        // Parse boolean handling
        if (nextArg === "true" || nextArg === "false") {
          // Boolean parameter: true means include, false means omit
          if (nextArg === "true") {
            flags[flagName] = true;
          }
          // false means omit the flag entirely
          i += 2;
        } else {
          flags[flagName] = nextArg;
          i += 2;
        }
      } else {
        // No value — boolean flag (implicitly true)
        flags[flagName] = true;
        i += 1;
      }
    } else {
      // Non-flag argument (skip)
      i += 1;
    }
  }

  return { resource, func, flags };
}

// ---------------------------------------------------------------------------
// Resolved operation builder — converts parsed command to HTTP request
// ---------------------------------------------------------------------------

/**
 * Convert a parsed command to a resolved OpenAPI operation.
 * Matches the command against the command map to find the correct path and method.
 */
export function resolveOperation(
  command: ParsedCommand,
  commandMap: CommandMap,
  spec: OpenApiSpec
): ResolvedOperation {
  const { resource, func, flags } = command;

  // Find the resource and function in the command map
  const resourceDef = commandMap[resource];
  if (!resourceDef) {
    throw new OrcSpecError(`Unknown resource: ${resource}`);
  }

  const funcDef = resourceDef.functions[func];
  if (!funcDef) {
    throw new OrcSpecError(`Unknown function ${func} on resource ${resource}`);
  }

  // Find the matching path in the spec
  const [pathTemplate, method] = findPathTemplate(spec, resource, func);

  // Build the resolved path with placeholders replaced by flag values
  let resolvedPath = pathTemplate;
  const query: Record<string, string | number | boolean> = {};
  const body: Record<string, unknown> = {};

  for (const param of funcDef.params) {
    const flagValue = flags[param.name];

    // Boolean false means "omit the flag" — don't include it
    if (param.boolean && flagValue === false) {
      continue;
    }

    if (flagValue !== undefined) {
      if (param.location === "path") {
        // Replace path placeholder with flag value
        resolvedPath = resolvedPath.replace(`{${param.name}}`, String(flagValue));
      } else if (param.location === "query") {
        query[param.name] = flagValue;
      } else if (param.location === "body") {
        body[param.name] = flagValue;
      }
    } else if (param.required && param.location === "path") {
      throw new OrcSpecError(`Missing required path parameter: ${param.name}`);
    } else if (param.required && param.location === "body") {
      body[param.name] = undefined;
    }
  }

  return {
    path: resolvedPath,
    method,
    body: method === "GET" || method === "DELETE" ? null : body,
    query,
    pathTemplate,
    summary: funcDef.description || "",
    description: funcDef.description || "",
  };
}

/**
 * Find the matching path template in the spec for a given resource and function.
 * Returns [pathTemplate, method] tuple.
 */
function findPathTemplate(spec: OpenApiSpec, resource: string, func: string): [string, string] {
  const paths = spec.paths || {};

  // Try to find the path by matching tags or path structure
  for (const [pathTemplate, methods] of Object.entries(paths)) {
    for (const [method, operation] of Object.entries(methods)) {
      const tags = operation.tags || [];
      const operationId = operation.operationId || "";

      // Match by tag (resource)
      if (tags[0]?.toLowerCase() === resource) {
        // Check if operation matches the function
        const derivedFunc = deriveFunctionName(operationId, method, resource);
        if (derivedFunc === func || method.toLowerCase() === func) {
          return [pathTemplate, method.toUpperCase()];
        }
      }

      // Match by path structure
      const segments = pathTemplate.replace(/^\//, "").split("/").filter((s) => s.length > 0);
      if (segments.length >= 2) {
        if (segments[0].toLowerCase() === resource) {
          const secondSegment = segments[1].toLowerCase();
          const methodLower = method.toLowerCase();

          if (secondSegment === func || secondSegment === methodLower) {
            return [pathTemplate, method.toUpperCase()];
          }
        }
      }
    }
  }

  throw new OrcSpecError(`No matching path found for resource=${resource}, function=${func}`);
}

// ---------------------------------------------------------------------------
// Help text generators
// ---------------------------------------------------------------------------

/** Generate help text for the entire service */
export function help(commandMap: CommandMap, spec: OpenApiSpec): string {
  const title = spec.info?.title || "ORCa Service";
  const lines: string[] = [`ORCa: ${title}`];

  if (spec.info?.description) {
    lines.push("");
    lines.push(spec.info.description);
  }

  lines.push("");
  lines.push("Available resources:");

  for (const [resourceName, resourceDef] of Object.entries(commandMap)) {
    const desc = resourceDef.description ? ` — ${resourceDef.description}` : "";
    lines.push(`  ${resourceName}${desc}`);
  }

  lines.push("");
  lines.push("Usage: <resource> <function> [--flag value]");
  lines.push("  resource  — The resource name");
  lines.push("  function  — The function name (e.g., get, post, delete)");
  lines.push("  --flag    — Parameter flags (boolean flags omit value)");
  lines.push("");
  lines.push("Examples:");
  for (const [resourceName, resourceDef] of Object.entries(commandMap)) {
    const firstFunc = Object.keys(resourceDef.functions)[0];
    if (firstFunc) {
      lines.push(`  ${resourceName} ${firstFunc} --help`);
    }
  }

  return lines.join("\n");
}

/** Generate help text for a specific resource */
export function helpResource(commandMap: CommandMap, resource: string): string {
  const resourceDef = commandMap[resource];
  if (!resourceDef) {
    throw new OrcSpecError(`Unknown resource: ${resource}`);
  }

  const lines: string[] = [`Resource: ${resource}`];

  if (resourceDef.description) {
    lines.push("");
    lines.push(resourceDef.description);
  }

  lines.push("");
  lines.push("Available functions:");

  for (const [funcName, funcDef] of Object.entries(resourceDef.functions)) {
    const desc = funcDef.description ? ` — ${funcDef.description}` : "";
    lines.push(`  ${funcName}${desc}`);
  }

  lines.push("");
  lines.push("Usage: <resource> <function> [--flag value]");

  return lines.join("\n");
}

/** Generate help text for a specific function */
export function helpFunction(commandMap: CommandMap, resource: string, func: string): string {
  const resourceDef = commandMap[resource];
  if (!resourceDef) {
    throw new OrcSpecError(`Unknown resource: ${resource}`);
  }

  const funcDef = resourceDef.functions[func];
  if (!funcDef) {
    throw new OrcSpecError(`Unknown function ${func} on resource ${resource}`);
  }

  const lines: string[] = [`Function: ${resource} ${func}`];

  if (funcDef.description) {
    lines.push("");
    lines.push(funcDef.description);
  }

  lines.push("");
  lines.push("Parameters:");

  for (const param of funcDef.params) {
    const required = param.required ? " (required)" : " (optional)";
    const bool = param.boolean ? " [boolean]" : "";
    const type = param.type || "string";
    const desc = param.description ? ` — ${param.description}` : "";
    lines.push(`  --${param.name} ${type}${bool}${required}${desc}`);
  }

  lines.push("");
  lines.push("Example:");

  // Build example with placeholders
  const exampleParams: string[] = [];
  for (const param of funcDef.params) {
    if (param.required) {
      exampleParams.push(`<${param.name}>`);
    } else {
      exampleParams.push(`[--${param.name} value]`);
    }
  }

  lines.push(`  ${resource} ${func} ${exampleParams.join(" ")}`);

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// ORCClient implementation
// ---------------------------------------------------------------------------

/**
 * ORCClient — connects to a remote OpenAPI service and provides
 * CLI-like access to all its operations.
 */
export class OrcClient implements ORCClient {
  isConnected = false;
  url = "";
  spec: unknown = null;
  commandMap: CommandMap = {};

  /**
   * Connect to a remote service, fetch its OpenAPI spec, and parse it.
   * @param url The URL of the remote service's OpenAPI endpoint.
   */
  async connect(url: string): Promise<void> {
    // Validate URL
    try {
      new URL(url);
    } catch {
      throw new OrcSpecError(`Invalid URL: ${url}`);
    }

    this.url = url;
    this.isConnected = false;

    // Fetch the spec
    const response = await request(url, { method: "GET" });

    if (!response.statusCode || response.statusCode < 200 || response.statusCode >= 300) {
      throw new OrcSpecError(`Failed to fetch spec from ${url}: HTTP ${response.statusCode}`);
    }

    // Get response body as text
    const body = await response.body?.text();
    if (!body) {
      throw new OrcSpecError(`Empty response from ${url}`);
    }

    // Parse and validate the spec
    this.spec = validateSpec(body);

    // Build the command map
    this.commandMap = buildCommandMap(this.spec as OpenApiSpec);

    this.isConnected = true;
  }

  /** Disconnect and clear internal state. */
  disconnect(): void {
    this.isConnected = false;
    this.url = "";
    this.spec = null;
    this.commandMap = {};
  }

  /** Get the OpenAPI spec as a JSON string. */
  getSpecJson(): string {
    if (!this.spec) {
      throw new OrcSpecError("Not connected. Call connect() first.");
    }
    return JSON.stringify(this.spec, null, 2);
  }

  /** Get the parsed OpenAPI spec object. */
  getSpec(): unknown {
    return this.spec;
  }

  /** Generate help text for the entire service. */
  help(): string {
    if (!this.isConnected) {
      throw new OrcSpecError("Not connected. Call connect() first.");
    }
    return help(this.commandMap, this.spec as OpenApiSpec);
  }

  /** Generate help text for a specific resource. */
  helpResource(resource: string): string {
    if (!this.isConnected) {
      throw new OrcSpecError("Not connected. Call connect() first.");
    }
    return helpResource(this.commandMap, resource);
  }

  /** Generate help text for a specific function on a resource. */
  helpFunction(resource: string, func: string): string {
    if (!this.isConnected) {
      throw new OrcSpecError("Not connected. Call connect() first.");
    }
    return helpFunction(this.commandMap, resource, func);
  }

  /**
   * Execute a command string against the remote service.
   * @param command The command string.
   * @returns The response body as a JSON string.
   */
  async exec(command: string): Promise<string> {
    if (!this.isConnected) {
      throw new OrcSpecError("Not connected. Call connect() first.");
    }

    // Parse the command
    const parsed = parseCommand(command);

    // Resolve to an operation
    const operation = resolveOperation(parsed, this.commandMap, this.spec as OpenApiSpec);

    // Build the request URL
    let requestUrl = operation.path;

    // Append query parameters
    const queryParts: string[] = [];
    for (const [key, value] of Object.entries(operation.query)) {
      queryParts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
    }
    if (queryParts.length > 0) {
      requestUrl += `?${queryParts.join("&")}`;
    }

    // Send the request
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    const body = operation.body ? JSON.stringify(operation.body) : undefined;

    const response = await request(requestUrl, {
      method: operation.method as "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
      headers,
      body,
    });

    if (!response.statusCode || response.statusCode < 200 || response.statusCode >= 300) {
      const bodyText = await response.body?.text();
      throw new OrcSpecError(
        `Request failed: HTTP ${response.statusCode} — ${bodyText || "No response body"}`
      );
    }

    return response.body?.text() || "";
  }

  /** Parse a command string into its components. */
  parseCommand(command: string): ParsedCommand {
    return parseCommand(command);
  }
}
