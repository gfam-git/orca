# MCP Environment Variables Reference

## Overview

ORCa (OpenAPI as Remote CLI) uses environment variables to configure its connection to a remote service, authentication, and runtime behavior. This document lists every environment variable supported by ORCa, with its name, description, default value, and usage examples.

---

## Core Variables

### ORCA_SPEC_ENDPOINT

| Property | Value |
| --- | --- |
| **Required** | Yes |
| **Default** | None |
| **Description** | The URL of the remote service endpoint serving the OpenAPI specification. ORCa fetches its tool definitions from this URL. |
| **Validation** | Must be a valid URL. The server validates this on startup and refuses to start if unset, empty, or not a valid URL. |
| **Example** | `export ORCA_SPEC_ENDPOINT=https://api.example.com/openapi.json` |

```bash
export ORCA_SPEC_ENDPOINT=https://api.example.com/spec
```

**Error if missing:**
```
ERROR: ORCA_SPEC_ENDPOINT is not set.
  Set it to the URL of a remote service exposing an OpenAPI spec.
```

---

### ORCA_SERVICE_BASE_URL

| Property | Value |
| --- | --- |
| **Required** | No |
| **Default** | Falls back to `ORCA_SPEC_ENDPOINT` |
| **Description** | An optional URL for live API calls. When set, the client fetches the spec from `ORCA_SPEC_ENDPOINT` but sends API requests to `ORCA_SERVICE_BASE_URL`. When unset, the server automatically extracts a base URL from the OpenAPI spec's `servers` property (top-level or per-path). If no servers are defined in the spec, it falls back to `ORCA_SPEC_ENDPOINT`. |
| **Validation** | Must be a valid URL. If invalid, a warning is printed and the server falls back to `ORCA_SPEC_ENDPOINT`. |
| **Example** | `export ORCA_SERVICE_BASE_URL=https://api.example.com/v1` |

```bash
export ORCA_SPEC_ENDPOINT=https://api.example.com/spec
export ORCA_SERVICE_BASE_URL=https://api.example.com/v1
```

**Behavior when unset:**
- Spec is fetched from `ORCA_SPEC_ENDPOINT`
- API requests go to the same URL as `ORCA_SPEC_ENDPOINT` (or the spec's `servers` URL if present)

**Error if invalid:**
```
WARNING: ORCA_SERVICE_BASE_URL is not a valid URL: <value>
  Falling back to ORCA_SPEC_ENDPOINT for API calls.
```

---

## Authentication Variables

Authentication configuration follows a two-tier priority system:

1. **Environment variable override** (highest priority): If `ORCA_AUTH_METHOD` is set and non-empty, that method is used regardless of the OpenAPI spec.
2. **Spec inference** (fallback): If no `ORCA_AUTH_METHOD` env var is set, the first `securitySchemes` entry in the OpenAPI spec determines the auth method.

### ORCA_AUTH_METHOD

| Property | Value |
| --- | --- |
| **Required** | Yes (when overriding spec inference) |
| **Default** | None (inferred from spec if unset) |
| **Description** | Forces the authentication method. One of: `none`, `bearer`, `basic`, `apikey`. Overrides any auth inferred from the OpenAPI spec's `components.securitySchemes`. |
| **Valid values** | `none`, `bearer`, `basic`, `apikey` |
| **Example** | `export ORCA_AUTH_METHOD=bearer` |

```bash
export ORCA_AUTH_METHOD=bearer
```

**Supported values:**

| Value | Description |
| --- | --- |
| `none` | Disables authentication |
| `bearer` | Uses bearer token authentication |
| `basic` | Uses HTTP Basic authentication |
| `apikey` | Uses API key authentication |

**Error if invalid:**
```
ERROR: Unsupported auth method: <value>. Supported methods: none, bearer, basic, apikey
```

---

### ORCA_AUTH_BEARER_TOKEN

| Property | Value |
| --- | --- |
| **Required** | Yes (when `ORCA_AUTH_METHOD=bearer` or when the env var is set) |
| **Default** | None |
| **Description** | The bearer token value used for Bearer authentication. |
| **Example** | `export ORCA_AUTH_BEARER_TOKEN=eyJhbGciOiJIUzI1NiIsInR...` |

```bash
export ORCA_AUTH_BEARER_TOKEN=your_token_here
```

**Error if missing:**
```
ERROR: ORCA_AUTH_BEARER_TOKEN is required when auth method is 'bearer'
```

---

### ORCA_AUTH_BASIC_USERNAME

| Property | Value |
| --- | --- |
| **Required** | Yes (when `ORCA_AUTH_METHOD=basic` or when any basic auth env var is set) |
| **Default** | None |
| **Description** | The username for HTTP Basic authentication. |
| **Example** | `export ORCA_AUTH_BASIC_USERNAME=your_username` |

```bash
export ORCA_AUTH_BASIC_USERNAME=your_username
```

**Error if missing:**
```
ERROR: ORCA_AUTH_BASIC_USERNAME is required when auth method is 'basic'
```

---

### ORCA_AUTH_BASIC_PASSWORD

| Property | Value |
| --- | --- |
| **Required** | Yes (when `ORCA_AUTH_METHOD=basic` or when any basic auth env var is set) |
| **Default** | None |
| **Description** | The password for HTTP Basic authentication. |
| **Example** | `export ORCA_AUTH_BASIC_PASSWORD=your_password` |

```bash
export ORCA_AUTH_BASIC_PASSWORD=your_password
```

**Error if missing:**
```
ERROR: ORCA_AUTH_BASIC_PASSWORD is required when auth method is 'basic'
```

---

### ORCA_AUTH_APIKEY_NAME

| Property | Value |
| --- | --- |
| **Required** | Yes (when `ORCA_AUTH_METHOD=apikey` or when any apikey env var is set) |
| **Default** | None |
| **Description** | The API key parameter name (the key name used in the API request). |
| **Example** | `export ORCA_AUTH_APIKEY_NAME=X-API-Key` |

```bash
export ORCA_AUTH_APIKEY_NAME=X-API-Key
```

**Error if missing:**
```
ERROR: ORCA_AUTH_APIKEY_NAME is required when auth method is 'apikey'
```

---

### ORCA_AUTH_APIKEY_VALUE

| Property | Value |
| --- | --- |
| **Required** | Yes (when `ORCA_AUTH_METHOD=apikey` or when any apikey env var is set) |
| **Default** | None |
| **Description** | The API key value to be injected into requests. |
| **Example** | `export ORCA_AUTH_APIKEY_VALUE=your_api_key_value` |

```bash
export ORCA_AUTH_APIKEY_VALUE=your_api_key_value
```

**Error if missing:**
```
ERROR: ORCA_AUTH_APIKEY_VALUE is required when auth method is 'apikey'
```

---

### ORCA_AUTH_APIKEY_IN

| Property | Value |
| --- | --- |
| **Required** | No |
| **Default** | `header` |
| **Description** | Where to inject the API key in requests. One of: `header`, `query`, `cookie`. |
| **Valid values** | `header`, `query`, `cookie` |
| **Example** | `export ORCA_AUTH_APIKEY_IN=query` |

```bash
export ORCA_AUTH_APIKEY_IN=header   # Default
export ORCA_AUTH_APIKEY_IN=query
export ORCA_AUTH_APIKEY_IN=cookie
```

**Supported values:**

| Value | Injection |
| --- | --- |
| `header` | Added as a request header: `<X-API-Key>: <value>` |
| `query` | Added as a query parameter: `?X-API-Key=<value>` |
| `cookie` | Added as a cookie: `Cookie: X-API-Key=<value>` |

**Error if invalid:** Invalid values are ignored and default to `header`.

---

## Priority Table

| Env Var Set | Spec Has securitySchemes | Result |
| --- | --- | --- |
| Yes (`ORCA_AUTH_METHOD=bearer`) | Yes | `bearer` (env override wins) |
| Yes (`ORCA_AUTH_METHOD=bearer`) | No | `bearer` (env override) |
| No | Yes | Inferred from first security scheme |
| No | No | `none` |

---

## Spec-Based Inference Rules

When `ORCA_AUTH_METHOD` is not set, ORCa examines the first entry in the OpenAPI spec's `components.securitySchemes`:

| Security Scheme Type | Scheme Value | Inferred Method |
| --- | --- | --- |
| `http` | `bearer` | `bearer` |
| `http` | `basic` | `basic` |
| `http` | other | `none` |
| `apiKey` | any | `apikey` |
| other type | any | `none` |

---

## Complete Examples

### Example 1: Bearer Auth via Env Override

```bash
export ORCA_SPEC_ENDPOINT=https://api.example.com/spec
export ORCA_AUTH_METHOD=bearer
export ORCA_AUTH_BEARER_TOKEN=eyJhbGciOiJIUzI1NiIsInR...
```

Result:
- Auth method: `bearer` (from env override)
- Header: `Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR...`
- The spec's securitySchemes are ignored for method selection.

### Example 2: API Key via Env Override

```bash
export ORCA_SPEC_ENDPOINT=https://api.example.com/spec
export ORCA_AUTH_METHOD=apikey
export ORCA_AUTH_APIKEY_NAME=X-API-Key
export ORCA_AUTH_APIKEY_VALUE=your_api_key_value
export ORCA_AUTH_APIKEY_IN=header
```

Result:
- Auth method: `apikey` (from env override)
- Header: `X-API-Key: your_api_key_value`
- The spec's securitySchemes are ignored for method selection.

### Example 3: Basic Auth via Env Override

```bash
export ORCA_SPEC_ENDPOINT=https://api.example.com/spec
export ORCA_AUTH_METHOD=basic
export ORCA_AUTH_BASIC_USERNAME=myuser
export ORCA_AUTH_BASIC_PASSWORD=mypassword
```

Result:
- Auth method: `basic` (from env override)
- Header: `Authorization: Basic <base64(myuser:mypassword)>`

### Example 4: No Auth

```bash
export ORCA_SPEC_ENDPOINT=https://api.example.com/spec
export ORCA_AUTH_METHOD=none
```

Result:
- Auth method: `none`
- No auth headers injected

---

## Auth Configuration Object

The resolved auth configuration is stored in an `AuthConfig` object:

```typescript
interface AuthConfig {
  method: "none" | "bearer" | "basic" | "apikey";
  bearerToken?: string;
  basicUsername?: string;
  basicPassword?: string;
  apikeyName?: string;
  apikeyValue?: string;
  apikeyIn?: "header" | "query" | "cookie";
}
```

---

## Header Injection Reference

When a request is executed, auth headers are injected into the request headers object:

| Method | Header Injected |
| --- | --- |
| `bearer` | `Authorization: Bearer <token>` |
| `basic` | `Authorization: Basic <base64(username:password)>` |
| `apikey` (header) | `<apikeyName>: <apikeyValue>` |
| `apikey` (cookie) | `Cookie: <apikeyName>=<apikeyValue>` |
| `apikey` (query) | No header injected (handled separately) |
| `none` | No injection |

---

## Quick Reference Table

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `ORCA_SPEC_ENDPOINT` | Yes | None | URL of remote OpenAPI spec |
| `ORCA_SERVICE_BASE_URL` | No | `ORCA_SPEC_ENDPOINT` | URL for live API calls |
| `ORCA_AUTH_METHOD` | No* | Inferred from spec | Auth method override |
| `ORCA_AUTH_BEARER_TOKEN` | Conditional | None | Bearer token value |
| `ORCA_AUTH_BASIC_USERNAME` | Conditional | None | Basic auth username |
| `ORCA_AUTH_BASIC_PASSWORD` | Conditional | None | Basic auth password |
| `ORCA_AUTH_APIKEY_NAME` | Conditional | None | API key parameter name |
| `ORCA_AUTH_APIKEY_VALUE` | Conditional | None | API key value |
| `ORCA_AUTH_APIKEY_IN` | No | `header` | API key injection location |
| `ORCA_EXCLUDE_TAGS` | No | None | Comma-delimited tag names to exclude from the command map |
| `ORCA_API_ROOT` | No | None | Leading path segment to strip from spec paths (e.g. `/v1`) |

*Required when overriding spec inference.

---

## Path Configuration

### ORCA_API_ROOT

| Property | Value |
| --- | --- |
| **Required** | No |
| **Default** | None (no prefix stripped) |
| **Description** | A leading path segment to strip from OpenAPI spec paths before parsing. When an API spec is mounted under a prefix (e.g. `/v1` or `/api`), this variable tells ORCa to remove that prefix so that path segments are correctly interpreted as resources and functions. |
| **Validation** | Must be a single path segment starting with `/` (e.g. `'/v1'`, `'/api'`, `'/'`). Invalid values (multiple segments, invalid characters) are silently ignored. Trailing slashes are stripped automatically. |
| **Example** | `export ORCA_API_ROOT=/v1` |

```bash
export ORCA_SPEC_ENDPOINT=https://laya.studio/v1/openapi
export ORCA_API_ROOT=/v1
```

**Behavior when set:**
- The root prefix is stripped from spec paths before building the command map
- The same prefix is stripped from resolved paths when making HTTP requests
- Path segments after the root become resource and function names

**Behavior when unset:**
- Paths are used as-is (no stripping)
- Existing behavior is unchanged

**Error if invalid:**
- Invalid values (multiple segments like `/v1/api`) are silently ignored; ORCa behaves as if the variable is unset.
```
