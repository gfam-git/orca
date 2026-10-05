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
  AuthConfig,
  SecurityScheme,
} from "./types.js";
import {
  parseAuthConfig,
  injectAuthHeaders,
  injectApiKeyQuery,
} from "./auth.js";

// ---------------------------------------------------------------------------
// OpenAPI spec types (minimal, for parsing)
// ---------------------------------------------------------------------------

interface OpenApiSpec {
  openapi?: string;
  info?: { title?: string; description?: string };
  servers?: { url?: string }[];
  paths?: Record<string, Record<string, OpenApiOperation>>;
  components?: { schemas?: Record<string, OpenApiSchema>; securitySchemes?: Record<string, SecurityScheme> };
}

interface OpenApiOperation {
  tags?: string[];
  operationId?: string;
  summary?: string;
  description?: string;
  parameters?: OpenApiParam[];
  requestBody?: OpenApiRequestBody;
  responses?: Record<string, OpenApiResponseBody>;
  servers?: { url?: string }[];
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
  $ref?: string;
  additionalProperties?: OpenApiSchema;
  oneOf?: OpenApiSchema[];
  anyOf?: OpenApiSchema[];
}

/** Resolve a $ref pointer against the spec's components/schemas */
function resolveRef(schema: OpenApiSchema, spec: OpenApiSpec): OpenApiSchema {
  if (!schema.$ref) return schema;
  const ref = schema.$ref;
  // Only resolve local refs of the form #/components/schemas/Name
  const match = ref.match(/^#\/components\/schemas\/(\w+)$/);
  if (match) {
    const schemas = spec.components?.schemas;
    if (schemas && schemas[match[1]]) {
      return resolveRef(schemas[match[1]] as OpenApiSchema, spec);
    }
  }
  return schema;
}

/** Recursively resolve $ref chains on a schema (handles nested refs) */
function resolveSchema(schema: OpenApiSchema, spec: OpenApiSpec): OpenApiSchema {
  let resolved = resolveRef(schema, spec);
  // If properties contain refs, resolve them too
  if (resolved.properties) {
    resolved.properties = Object.fromEntries(
      Object.entries(resolved.properties).map(([k, v]) => [k, resolveSchema(v as OpenApiSchema, spec)])
    );
  }
  // Resolve items schema (for arrays)
  if (resolved.items) {
    resolved.items = resolveSchema(resolved.items as OpenApiSchema, spec);
  }
  // Resolve additionalProperties
  if (resolved.additionalProperties) {
    resolved.additionalProperties = resolveSchema(resolved.additionalProperties as OpenApiSchema, spec);
  }
  // Resolve oneOf/anyOf (take first for now)
  if (resolved.oneOf && resolved.oneOf[0]) {
    resolved.oneOf = [resolveSchema(resolved.oneOf[0] as OpenApiSchema, spec), ...(resolved.oneOf.slice(1) as OpenApiSchema[])];
  }
  return resolved;
}

/** Get all property names from a schema, including nested refs */
function getSchemaProperties(schema: OpenApiSchema, spec: OpenApiSpec): OpenApiSchema {
  const resolved = resolveSchema(schema, spec);
  return resolved;
}

/** Extract nested property definitions from a schema for help text */
function extractNestedParams(param: ParamDef, spec: OpenApiSpec, depth: number = 1): string {
  const schema = param.schema as OpenApiSchema | undefined;
  if (!schema) return '';
  const resolved = resolveSchema(schema, spec);
  const lines: string[] = [];
  const indent = '  '.repeat(depth);
  const required = resolved.required || [];

  if (resolved.type === 'array' && resolved.items) {
    // Array body param: extract properties from items schema
    const itemResolved = resolveSchema(resolved.items as OpenApiSchema, spec);
    const itemProps = itemResolved.properties || {};
    const itemRequired = itemResolved.required || [];
    const props = Object.entries(itemProps);
    for (const [propName, propSchema] of props) {
      const pResolved = resolveSchema(propSchema as OpenApiSchema, spec);
      const req = itemRequired.includes(propName) ? ' (required)' : '';
      const pType = pResolved.type || 'object';
      const desc = pResolved.description ? ` — ${pResolved.description}` : '';

      lines.push(`${indent}  --${propName} ${pType}${req}${desc}`);
      if (pType === 'object' || pType === 'array') {
        const nested = extractNestedParams({ ...param, schema: pResolved as unknown as Record<string, unknown> }, spec, depth + 1);
        if (nested) {
          lines.push(nested);
        }
      } else if (pType === 'string' || pType === 'integer' || pType === 'number' || pType === 'boolean') {
        const bool = pType === 'boolean' ? ' [boolean]' : '';
        lines.push(`${indent}    --${propName} ${pType}${bool}${req}${desc}`);
      } else {
        lines.push(`${indent}    --${propName} ${pType}${req}${desc}`);
      }
    }
  } else if (resolved.properties) {
    const props = Object.entries(resolved.properties);
    for (const [propName, propSchema] of props) {
      const pResolved = resolveSchema(propSchema as OpenApiSchema, spec);
      const req = required.includes(propName) ? ' (required)' : '';
      const pType = pResolved.type || 'object';
      const desc = pResolved.description ? ` — ${pResolved.description}` : '';

      if (pType === 'object' || pType === 'array') {
        lines.push(`${indent}  --${propName} ${pType}${req}${desc}`);
        // Recurse for nested objects
        const nested = extractNestedParams({ ...param, schema: pResolved as unknown as Record<string, unknown> }, spec, depth + 1);
        if (nested) {
          lines.push(nested);
        }
      } else if (pType === 'string' || pType === 'integer' || pType === 'number' || pType === 'boolean') {
        const bool = pType === 'boolean' ? ' [boolean]' : '';
        lines.push(`${indent}    --${propName} ${pType}${bool}${req}${desc}`);
      } else {
        lines.push(`${indent}    --${propName} ${pType}${req}${desc}`);
      }
    }
  }

  return lines.join('\n');
}

/** Build a concise schema description for help text */
function buildSchemaDescription(schema: OpenApiSchema, spec: OpenApiSpec): string {
  const resolved = resolveSchema(schema, spec);
  const parts: string[] = [];

  if (resolved.type === 'array') {
    const itemSchema = resolved.items;
    const itemResolved = itemSchema ? resolveSchema(itemSchema, spec) : null;
    const itemType = itemResolved?.type || 'object';
    parts.push(`array of ${itemType}`);
    if (itemResolved && itemResolved.properties) {
      const propNames = Object.keys(itemResolved.properties);
      parts.push(`(${propNames.join(', ')})`);
    }
  } else if (resolved.type === 'object' && resolved.properties) {
    const propNames = Object.keys(resolved.properties);
    parts.push(`object (${propNames.join(', ')})`);
  } else {
    parts.push(resolved.type || 'any');
  }

  return parts.join('');
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
// Automatic server URL extraction from OpenAPI spec
// ---------------------------------------------------------------------------

/**
 * Extract the best available server URL from an OpenAPI spec.
 * Priority: top-level servers[0].url, then first per-path server, then null.
 * Only returns URLs that are valid (have a scheme or are absolute paths).
 */
export function extractServerUrl(spec: OpenApiSpec): string | null {
  // 1. Try top-level servers
  const topLevelServers = spec.servers;
  if (topLevelServers && topLevelServers.length > 0) {
    for (const server of topLevelServers) {
      if (server && server.url && isValidServerUrl(server.url)) {
        return server.url;
      }
    }
  }

  // 2. Fall back to per-path servers
  const paths = spec.paths || {};
  for (const [_path, methods] of Object.entries(paths)) {
    const ops = methods as Record<string, OpenApiOperation>;
    for (const [_method, operation] of Object.entries(ops)) {
      const pathServers = operation.servers;
      if (pathServers && pathServers.length > 0) {
        for (const server of pathServers) {
          if (server && server.url && isValidServerUrl(server.url)) {
            return server.url;
          }
        }
      }
    }
  }

  return null;
}

/** Check if a server URL is valid for use as a base URL */
function isValidServerUrl(urlStr: string): boolean {
  try {
    new URL(urlStr);
    return true;
  } catch {
    // Not a valid URL — reject it
    return false;
  }
}

// ---------------------------------------------------------------------------
// Command map builder — transforms OpenAPI spec into Resource -> Function -> Params
// ---------------------------------------------------------------------------

/**
 * Parse ORCA_EXCLUDE_TAGS env var into a set of tag names to exclude.
 * Returns an empty set if the variable is unset or empty.
 */
function getExcludedTags(): Set<string> {
  const envVal = process.env.ORCA_EXCLUDE_TAGS;
  if (!envVal || envVal.trim() === "") {
    return new Set();
  }
  return new Set(envVal.split(",").map((t) => t.trim()).filter((t) => t.length > 0));
}

/**
 * Check whether an operation should be excluded based on its tags and ORCA_EXCLUDE_TAGS.
 */
function isExcludedOperation(operation: OpenApiOperation): boolean {
  const excluded = getExcludedTags();
  if (excluded.size === 0) return false;
  const tags = operation.tags || [];
  return tags.some((tag) => excluded.has(tag));
}

// ---------------------------------------------------------------------------
// ORCA_API_ROOT — strip leading path prefix from spec paths
// ---------------------------------------------------------------------------

/**
 * Parse ORCA_API_ROOT env var into a root prefix string.
 * Returns '' (empty) if unset or empty.
 * Normalizes: strips trailing slash, ensures leading slash.
 * Only accepts a single path segment (e.g. '/', '/api', '/v1').
 * Invalid values (multiple segments, invalid characters) are ignored.
 */
export function parseApiRoot(): string {
  const envVal = process.env.ORCA_API_ROOT;
  if (!envVal || envVal.trim() === '') {
    return '';
  }
  let root = envVal.trim();
  // Ensure leading slash
  if (!root.startsWith('/')) {
    root = '/' + root;
  }
  // Strip trailing slash(es)
  root = root.replace(/\/+$/, '');
  // If the root is now empty (was just '/'), treat it as root
  if (root === '') {
    root = '/';
  }
  // Validate: must be a single path segment (no embedded slashes after the first)
  const rest = root.slice(1);
  if (rest.includes('/')) {
    // Multiple segments — invalid, ignore
    return '';
  }
  return root;
}

/**
 * Strip the ORCA_API_ROOT prefix from a path template.
 * E.g. '/v1/users' with root '/v1' → '/users'
 * If root is '/' it is stripped entirely (it's the spec mount point).
 * If root is '' nothing is stripped.
 */
function stripApiRoot(pathTemplate: string, apiRoot: string): string {
  if (!apiRoot) return pathTemplate;
  // When root is '/', strip the leading slash
  if (apiRoot === '/') return pathTemplate.startsWith('/') ? pathTemplate.slice(1) : pathTemplate;
  return pathTemplate.startsWith(apiRoot) ? pathTemplate.slice(apiRoot.length) : pathTemplate;
}

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
 * - Operations with tags matching ORCA_EXCLUDE_TAGS are skipped.
 * - When ORCA_API_ROOT is set, the root prefix is stripped from paths before parsing.
 */
export function buildCommandMap(spec: OpenApiSpec): CommandMap {
  const commandMap: CommandMap = {};
  const paths = spec.paths || {};
  const apiRoot = parseApiRoot();

  for (const [pathTemplate, methods] of Object.entries(paths)) {
    const strippedPath = stripApiRoot(pathTemplate, apiRoot);

    for (const [method, operation] of Object.entries(methods)) {
      if (!isHttpMethod(method)) continue;

      // Skip operations whose tags match ORCA_EXCLUDE_TAGS
      if (isExcludedOperation(operation)) continue;

      // const tags = operation.tags || [];
      // const operationId = operation.operationId || "";

      // Determine resource and function name from the stripped path
      const { resource, func } = resolveResourceAndFunction(strippedPath, method, operation);

      // Build function definition
      const funcDef: FuncDef = {
        name: func,
        description: operation.summary || operation.description,
        params: buildParamDefs(operation, strippedPath, spec),
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
  operation: OpenApiOperation
): { resource: string; func: string } {
  // Path-based resolution first (most accurate for OpenAPI paths with parameters)
  // Normalize path: remove path params like {tabId}, split by /
  const segments = pathTemplate
    .replace(/\{[^/]*\}/g, "")
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

  // Fall back to tags for path-less or single-segment paths
  const tags = operation.tags || [];
  if (tags.length > 0) {
    const resource = tags[0].toLowerCase();
    const operationId = operation.operationId || "";
    const func = deriveFunctionName(operationId, method, resource);
    return { resource, func };
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
function buildParamDefs(operation: OpenApiOperation, pathTemplate: string, spec: OpenApiSpec): ParamDef[] {
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
    const resolved = resolveSchema(schema as OpenApiSchema, spec);
    const paramType = resolved.type || "string";
    const location = (param.in || "query") as "query" | "path" | "body";
    const isBoolean = paramType === "boolean";

    const isJson = paramType === "object" || paramType === "array";
    params.push({
      name: param.name,
      type: paramType,
      description: resolved.description || param.description,
      required: param.required === true,
      boolean: isBoolean,
      location,
      json: isJson,
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
          let schema = bodyDef.schema;
          if (!schema) continue;
          // Resolve any $ref on the top-level schema using the real spec
          const resolved = resolveSchema(schema as OpenApiSchema, spec);
          if (resolved.properties) {
            const required = resolved.required || [];
            for (const [propName, propSchema] of Object.entries(resolved.properties)) {
              const existing = params.find((p) => p.name === propName);
              if (!existing) {
                const pSchema = propSchema as OpenApiSchema;
                const pResolved = resolveSchema(pSchema, spec);
                const pType = pResolved.type || "string";
                const isJson = pType === "object" || pType === "array";
                params.push({
                  name: propName,
                  type: pType,
                  description: pResolved.description || pSchema.description,
                  required: required.includes(propName),
                  boolean: pType === "boolean",
                  location: "body",
                  json: isJson,
                  schema: pType === "object" || pType === "array" ? (pResolved as unknown as Record<string, unknown>) : undefined,
                });
              }
            }
          } else if (resolved.type === "array" && resolved.items) {
            // Array body param: extract properties from items schema
            const itemResolved = resolveSchema(resolved.items as OpenApiSchema, spec);
            if (itemResolved.properties) {
              const required = itemResolved.required || [];
              for (const [propName, propSchema] of Object.entries(itemResolved.properties)) {
                const existing = params.find((p) => p.name === propName);
                if (!existing) {
                  const pSchema = propSchema as OpenApiSchema;
                  const pResolved = resolveSchema(pSchema, spec);
                  const pType = pResolved.type || "string";
                  const isJson = pType === "object" || pType === "array";
                  params.push({
                    name: propName,
                    type: pType,
                    description: pResolved.description || pSchema.description,
                    required: required.includes(propName),
                    boolean: pType === "boolean",
                    location: "body",
                    json: isJson,
                    schema: pType === "object" || pType === "array" ? (pResolved as unknown as Record<string, unknown>) : undefined,
                  });
                }
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
 *
 * Quote handling: outer quotes are stripped, internal quotes are preserved.
 * E.g. "--schema '{"type":"object"}'" → schema = {"type":"object"}
 */
export function parseCommand(command: string): ParsedCommand {
  // Split on whitespace, preserving quoted strings
  const args: string[] = [];
  let current = "";
  let inQuote = false;
  let quoteChar: string | null = null;
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

    // If inside quotes, accumulate everything including internal quotes
    if (inQuote) {
      if (ch === quoteChar) {
        // Closing quote — skip it, don't include in current
        inQuote = false;
        quoteChar = null;
        continue;
      }
      current += ch;
      continue;
    }

    // Start a new quoted region (only at token boundary)
    if ((ch === '"' || ch === "'") && current.length === 0) {
      inQuote = true;
      quoteChar = ch;
      continue;
    }

    if (ch === " " || ch === "\t" || ch === "\n" || ch === "\r") {
      if (current.length > 0) {
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
  const apiRoot = parseApiRoot();

  // Strip API root prefix from the resolved path for the actual HTTP request
  resolvedPath = stripApiRoot(resolvedPath, apiRoot);
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
        // Replace path placeholder with flag value; true (no value) → empty string
        const pathVal = flagValue === true ? "" : String(flagValue);
        resolvedPath = resolvedPath.replace(`{${param.name}}`, pathVal);
      } else if (param.location === "query") {
        // JSON-type query params: try to parse as JSON object/array
        if (param.json && typeof flagValue === "string") {
          try {
            const parsed = JSON.parse(flagValue);
            query[param.name] = parsed;
          } catch {
            // Not valid JSON — keep as string
            query[param.name] = flagValue;
          }
        } else {
          query[param.name] = flagValue;
        }
      } else if (param.location === "body") {
        // Coerce body param value to param type
        let bodyVal: unknown = flagValue;
        if (param.json && typeof flagValue === "string") {
          // JSON-type: parse the string as JSON object/array
          try {
            bodyVal = JSON.parse(flagValue);
          } catch {
            // Not valid JSON — keep as string
          }
        } else if (param.type === "number" && typeof flagValue === "string") {
          const num = Number(flagValue);
          bodyVal = !isNaN(num) ? num : flagValue;
        } else if (param.type === "boolean" && typeof flagValue === "string") {
          bodyVal = flagValue === "true";
        }
        body[param.name] = bodyVal;
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
 * When ORCA_API_ROOT is set, paths are matched against the stripped version
 * so that resource names derived from stripped paths in buildCommandMap
 * align correctly with spec paths.
 */
function findPathTemplate(spec: OpenApiSpec, resource: string, func: string): [string, string] {
  const paths = spec.paths || {};
  const apiRoot = parseApiRoot();

  // Try to find the path by matching tags or path structure
  for (const [pathTemplate, methods] of Object.entries(paths)) {
    const strippedPath = stripApiRoot(pathTemplate, apiRoot);

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

      // Match by path structure (using stripped path for segment comparison)
      const segments = strippedPath
        .replace(/^\//, "")
        .split("/")
        .filter((s) => s.length > 0)
        .map((s) => s.replace(/\{[^}]*\}/g, ""))
        .filter((s) => s.length > 0);
      const methodLower = method.toLowerCase();
      if (segments.length >= 2) {
        if (segments[0] === resource) {
          const secondSegment = segments[1];

          if (secondSegment === func || secondSegment === methodLower) {
            return [pathTemplate, method.toUpperCase()];
          }
        }
      } else if (segments.length === 1 && segments[0] === resource && func === methodLower) {
        return [pathTemplate, method.toUpperCase()];
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
export function helpFunction(commandMap: CommandMap, resource: string, func: string, spec: OpenApiSpec): string {
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

    // Recursively expand nested object/array body params
    if (param.location === "body" && (param.type === "object" || param.type === "array") && !param.boolean) {
      const nested = extractNestedParams(param, spec, 1);
      if (nested) {
        lines.push(nested);
      }
    }
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
  serviceBaseUrl: string | undefined = undefined;
  spec: unknown = null;
  commandMap: CommandMap = {};
  authConfig: AuthConfig = { method: "none" };

  /**
   * Connect to a remote service, fetch its OpenAPI spec, and parse it.
   * @param url The URL of the remote service's OpenAPI endpoint.
   * @param serviceUrl Optional URL for live API calls (defaults to url if not provided).
   */
  async connect(url: string, serviceUrl?: string): Promise<void> {
    // Validate URL
    try {
      new URL(url);
    } catch {
      throw new OrcSpecError(`Invalid URL: ${url}`);
    }

    this.url = url;
    this.serviceBaseUrl = serviceUrl || url;
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

    // Auto-detect server URL from spec's servers property
    const detectedServer = extractServerUrl(this.spec as OpenApiSpec);
    if (detectedServer && !this.serviceBaseUrl) {
      this.serviceBaseUrl = detectedServer;
    }

    // Parse authentication config from spec securitySchemes + env vars
    const specTyped = this.spec as OpenApiSpec;
    const securitySchemes = specTyped.components?.securitySchemes;
    this.authConfig = parseAuthConfig(securitySchemes);

    // Build the command map
    this.commandMap = buildCommandMap(this.spec as OpenApiSpec);

    this.isConnected = true;
  }

  /** Disconnect and clear internal state. */
  disconnect(): void {
    this.isConnected = false;
    this.url = "";
    this.serviceBaseUrl = undefined;
    this.spec = null;
    this.commandMap = {};
    this.authConfig = { method: "none" };
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
    return helpFunction(this.commandMap, resource, func, this.spec as OpenApiSpec);
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

    // Prepend service base URL if set
    if (this.serviceBaseUrl) {
      const base = this.serviceBaseUrl.endsWith('/')
        ? this.serviceBaseUrl.slice(0, -1)
        : this.serviceBaseUrl;
      requestUrl = `${base}${operation.path}`;
    }

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

    // Inject authentication headers
    injectAuthHeaders(headers, this.authConfig);

    // Inject API key as query param if needed
    injectApiKeyQuery(operation.query, this.authConfig);

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
