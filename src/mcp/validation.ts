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
