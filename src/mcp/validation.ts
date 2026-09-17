// ---------------------------------------------------------------------------
// ORCA_SPEC_ENDPOINT and ORCA_SERVICE_BASE_URL validation
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

/**
 * Validate ORCA_SERVICE_BASE_URL environment variable.
 * Returns the URL if set and valid, otherwise returns the spec endpoint.
 */
export function validateServiceEndpoint(specEndpoint: string): string {
  const serviceUrl = process.env.ORCA_SERVICE_BASE_URL;

  if (!serviceUrl || serviceUrl.trim() === "") {
    return specEndpoint;
  }

  try {
    new URL(serviceUrl);
  } catch {
    console.error(`WARNING: ORCA_SERVICE_BASE_URL is not a valid URL: ${serviceUrl}`);
    console.error("  Falling back to ORCA_SPEC_ENDPOINT for API calls.");
    return specEndpoint;
  }

  return serviceUrl;
}
