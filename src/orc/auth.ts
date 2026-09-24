// ---------------------------------------------------------------------------
// Authentication module — parses ORCA_AUTH_* env vars, resolves auth method,
// and injects auth headers into requests.
// ---------------------------------------------------------------------------

import { AuthConfig, AuthMethod, SecurityScheme } from "./types";

/** Supported auth methods */
const SUPPORTED_METHODS: AuthMethod[] = ["none", "bearer", "basic", "apikey"];

/**
 * Parse authentication configuration from environment variables.
 *
 * Priority:
 * 1. ORCA_AUTH_METHOD env var (override)
 * 2. Infer from OpenAPI spec's components.securitySchemes
 *
 * @param specSecuritySchemes Optional security schemes from the OpenAPI spec.
 * @returns AuthConfig with the resolved authentication configuration.
 */
export function parseAuthConfig(
  specSecuritySchemes?: Record<string, SecurityScheme>
): AuthConfig {
  const methodEnv = process.env.ORCA_AUTH_METHOD;

  // Determine auth method and whether it came from env override or spec inference
  let method: AuthMethod;
  let fromEnvOverride = false;

  if (methodEnv && methodEnv.trim() !== "") {
    // Use env var override
    const overridden = methodEnv.toLowerCase().trim() as AuthMethod;
    if (!SUPPORTED_METHODS.includes(overridden)) {
      throw new Error(
        `Unsupported auth method: ${methodEnv}. Supported methods: ${SUPPORTED_METHODS.join(", ")}`
      );
    }
    method = overridden;
    fromEnvOverride = true;
  } else if (specSecuritySchemes && Object.keys(specSecuritySchemes).length > 0) {
    // Infer from spec's first security scheme
    const firstKey = Object.keys(specSecuritySchemes)[0];
    const scheme = specSecuritySchemes[firstKey];

    if (scheme.type === "http") {
      const schemeLower = (scheme.scheme || "").toLowerCase();
      if (schemeLower === "bearer") {
        method = "bearer";
      } else if (schemeLower === "basic") {
        method = "basic";
      } else {
        method = "none";
      }
    } else if (scheme.type === "apiKey") {
      method = "apikey";
    } else {
      method = "none";
    }
    fromEnvOverride = false;
  } else {
    // No auth required
    method = "none";
    fromEnvOverride = false;
  }

  // Build config based on method
  const config: AuthConfig = { method };

  // Only require env vars when the method came from env override (not from spec inference)
  if (method === "bearer" && (fromEnvOverride || process.env.ORCA_AUTH_BEARER_TOKEN)) {
    const token = process.env.ORCA_AUTH_BEARER_TOKEN;
    if (!token || token.trim() === "") {
      throw new Error(
        "ORCA_AUTH_BEARER_TOKEN is required when auth method is 'bearer'"
      );
    }
    config.bearerToken = token;
  } else if (method === "basic" && (fromEnvOverride || (process.env.ORCA_AUTH_BASIC_USERNAME || process.env.ORCA_AUTH_BASIC_PASSWORD))) {
    const username = process.env.ORCA_AUTH_BASIC_USERNAME;
    const password = process.env.ORCA_AUTH_BASIC_PASSWORD;
    if (!username || username.trim() === "") {
      throw new Error(
        "ORCA_AUTH_BASIC_USERNAME is required when auth method is 'basic'"
      );
    }
    if (!password || password.trim() === "") {
      throw new Error(
        "ORCA_AUTH_BASIC_PASSWORD is required when auth method is 'basic'"
      );
    }
    config.basicUsername = username;
    config.basicPassword = password;
  } else if (method === "apikey" && (fromEnvOverride || (process.env.ORCA_AUTH_APIKEY_NAME || process.env.ORCA_AUTH_APIKEY_VALUE))) {
    const apiKeyName = process.env.ORCA_AUTH_APIKEY_NAME;
    const apiKeyValue = process.env.ORCA_AUTH_APIKEY_VALUE;
    if (!apiKeyName || apiKeyName.trim() === "") {
      throw new Error(
        "ORCA_AUTH_APIKEY_NAME is required when auth method is 'apikey'"
      );
    }
    if (!apiKeyValue || apiKeyValue.trim() === "") {
      throw new Error(
        "ORCA_AUTH_APIKEY_VALUE is required when auth method is 'apikey'"
      );
    }
    const apiKeyIn = process.env.ORCA_AUTH_APIKEY_IN;
    config.apikeyName = apiKeyName;
    config.apikeyValue = apiKeyValue;
    if (apiKeyIn && (apiKeyIn === "header" || apiKeyIn === "query" || apiKeyIn === "cookie")) {
      config.apikeyIn = apiKeyIn as "header" | "query" | "cookie";
    } else {
      config.apikeyIn = "header";
    }
  }

  return config;
}

/**
 * Inject authentication headers into the request headers object.
 * Mutates the headers object in place.
 *
 * @param headers The headers object to modify.
 * @param config The auth configuration.
 */
export function injectAuthHeaders(
  headers: Record<string, string>,
  config: AuthConfig
): void {
  if (config.method === "none") {
    return;
  }

  if (config.method === "bearer" && config.bearerToken) {
    headers["Authorization"] = `Bearer ${config.bearerToken}`;
  } else if (config.method === "basic" && config.basicUsername && config.basicPassword) {
    const credentials = Buffer.from(
      `${config.basicUsername}:${config.basicPassword}`
    ).toString("base64");
    headers["Authorization"] = `Basic ${credentials}`;
  } else if (config.method === "apikey" && config.apikeyName && config.apikeyValue) {
    if (config.apikeyIn === "query") {
      // Query params are handled separately; skip header injection
      return;
    } else if (config.apikeyIn === "cookie") {
      headers["Cookie"] = `${config.apikeyName}=${config.apikeyValue}`;
    } else {
      // Default: header
      headers[config.apikeyName] = config.apikeyValue;
    }
  }
}

/**
 * Inject API key as query parameters.
 * Mutates the query object in place.
 *
 * @param query The query object to modify.
 * @param config The auth configuration.
 */
export function injectApiKeyQuery(
  query: Record<string, string | number | boolean>,
  config: AuthConfig
): void {
  if (config.method === "apikey" && config.apikeyIn === "query" && config.apikeyName && config.apikeyValue) {
    query[config.apikeyName] = config.apikeyValue;
  }
}
