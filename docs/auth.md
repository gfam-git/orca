# ORCa Authentication Configuration

## Overview

ORCa supports API authentication through environment variables and OpenAPI spec security schemes. Authentication is configured at the server level and applied automatically to all requests executed through the ORC client.

## Configuration Priority

Authentication configuration follows a two-tier priority system:

1. **Environment variable override** (highest priority): If `ORCA_AUTH_METHOD` is set and non-empty, that method is used regardless of the OpenAPI spec.
2. **Spec inference** (fallback): If no `ORCA_AUTH_METHOD` env var is set, the first `securitySchemes` entry in the OpenAPI spec determines the auth method.

### Priority Table

| Env Var Set | Spec Has `securitySchemes` | Result |
| --- | --- | --- |
| Yes (`ORCA_AUTH_METHOD=bearer`) | Yes | `bearer` (env override wins) |
| Yes (`ORCA_AUTH_METHOD=bearer`) | No | `bearer` (env override) |
| No | Yes | Inferred from first security scheme |
| No | No | `none` |

## Supported Auth Methods

| Method | Description | Header / Injection |
| --- | --- | --- |
| `none` | No authentication | None |
| `bearer` | Bearer token authentication | `Authorization: Bearer <token>` |
| `basic` | HTTP Basic authentication | `Authorization: Basic <base64(username:password)>` |
| `apikey` | API key authentication | Configurable: header, query, or cookie |

## Environment Variables

### ORCA_AUTH_METHOD

**Required when overriding spec inference.** One of: `none`, `bearer`, `basic`, `apikey`.

```bash
export ORCA_AUTH_METHOD=bearer
```

Supported values:

| Value | Description |
| --- | --- |
| `none` | Disables authentication |
| `bearer` | Uses bearer token authentication |
| `basic` | Uses HTTP Basic authentication |
| `apikey` | Uses API key authentication |

Invalid values cause the server to exit with an error:

```
ERROR: Unsupported auth method: <value>. Supported methods: none, bearer, basic, apikey
```

### ORCA_AUTH_BEARER_TOKEN

**Required when `ORCA_AUTH_METHOD=bearer` or when the env var is set.** The bearer token value.

```bash
export ORCA_AUTH_BEARER_TOKEN=your_token_here
```

Error if missing:

```
ERROR: ORCA_AUTH_BEARER_TOKEN is required when auth method is 'bearer'
```

### ORCA_AUTH_BASIC_USERNAME

**Required when `ORCA_AUTH_METHOD=basic` or when any basic auth env var is set.** The username for Basic auth.

```bash
export ORCA_AUTH_BASIC_USERNAME=your_username
```

### ORCA_AUTH_BASIC_PASSWORD

**Required when `ORCA_AUTH_METHOD=basic` or when any basic auth env var is set.** The password for Basic auth.

```bash
export ORCA_AUTH_BASIC_PASSWORD=your_password
```

Error if missing:

```
ERROR: ORCA_AUTH_BASIC_USERNAME is required when auth method is 'basic'
ERROR: ORCA_AUTH_BASIC_PASSWORD is required when auth method is 'basic'
```

### ORCA_AUTH_APIKEY_NAME

**Required when `ORCA_AUTH_METHOD=apikey` or when any apikey env var is set.** The API key parameter name (the key name used in the API).

```bash
export ORCA_AUTH_APIKEY_NAME=X-API-Key
```

Error if missing:

```
ERROR: ORCA_AUTH_APIKEY_NAME is required when auth method is 'apikey'
```

### ORCA_AUTH_APIKEY_VALUE

**Required when `ORCA_AUTH_METHOD=apikey` or when any apikey env var is set.** The API key value.

```bash
export ORCA_AUTH_APIKEY_VALUE=your_api_key_value
```

Error if missing:

```
ERROR: ORCA_AUTH_APIKEY_VALUE is required when auth method is 'apikey'
```

### ORCA_AUTH_APIKEY_IN

**Optional when `ORCA_AUTH_METHOD=apikey`.** Where to inject the API key. Defaults to `header`.

```bash
export ORCA_AUTH_APIKEY_IN=header   # Default
export ORCA_AUTH_APIKEY_IN=query
export ORCA_AUTH_APIKEY_IN=cookie
```

Supported values:

| Value | Injection |
| --- | --- |
| `header` | Added as a request header: `<X-API-Key>: <value>` |
| `query` | Added as a query parameter: `?X-API-Key=<value>` |
| `cookie` | Added as a cookie: `Cookie: X-API-Key=<value>` |

Invalid values are ignored and default to `header`.

## Spec-Based Inference

When `ORCA_AUTH_METHOD` is not set, ORCa examines the first entry in the OpenAPI spec's `components.securitySchemes` to determine the auth method.

### Inference Rules

| Security Scheme Type | Scheme Value | Inferred Method |
| --- | --- | --- |
| `http` | `bearer` | `bearer` |
| `http` | `basic` | `basic` |
| `http` | other | `none` |
| `apiKey` | any | `apikey` |
| other type | any | `none` |

### Example: Bearer Token from Spec

```yaml
components:
  securitySchemes:
    BearerAuth:
      type: http
      scheme: bearer
```

This infers `bearer` auth. However, since no env var is set, the server will **not** require `ORCA_AUTH_BEARER_TOKEN` -- it will proceed with `bearer` auth but no token (which may cause the remote service to reject the request).

### Example: API Key from Spec

```yaml
components:
  securitySchemes:
    ApiKeyAuth:
      type: apiKey
      name: X-API-Key
      in: header
```

This infers `apikey` auth. Since no env var is set, `ORCA_AUTH_APIKEY_NAME` and `ORCA_AUTH_APIKEY_VALUE` are **not** required at startup -- they would need to be provided via the spec or the remote service's own key mechanism.

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

## Header Injection

When a request is executed, auth headers are injected into the request headers object via `injectAuthHeaders()`:

| Method | Header Injected |
| --- | --- |
| `bearer` | `Authorization: Bearer <token>` |
| `basic` | `Authorization: Basic <base64(username:password)>` |
| `apikey` (header) | `<apikeyName>: <apikeyValue>` |
| `apikey` (cookie) | `Cookie: <apikeyName>=<apikeyValue>` |
| `apikey` (query) | No header injected (handled separately) |
| `none` | No injection |

## Query Injection

API keys with `apikeyIn=query` are injected into the query parameters via `injectApiKeyQuery()`:

```
GET /users?X-API-Key=<apikeyValue>
```

## Authentication Flow

1. **Startup**: `parseAuthConfig()` reads `ORCA_AUTH_METHOD` and env vars, or infers from the spec.
2. **Validation**: Required env vars are checked; missing required vars cause an error.
3. **Request**: `injectAuthHeaders()` modifies the request headers; `injectApiKeyQuery()` modifies query params.
4. **Execute**: The authenticated request is sent to the remote service.

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
- The spec's `securitySchemes` are ignored for method selection.

### Example 2: Basic Auth via Env Override

```bash
export ORCA_SPEC_ENDPOINT=https://api.example.com/spec
export ORCA_AUTH_METHOD=basic
export ORCA_AUTH_BASIC_USERNAME=myuser
export ORCA_AUTH_BASIC_PASSWORD=mypassword
```

Result:
- Auth method: `basic` (from env override)
- Header: `Authorization: Basic bXl1c2VyOm15cGFzc3dvcmQ=`
- The spec's `securitySchemes` are ignored for method selection.

### Example 3: API Key via Env Override (Header)

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
- The spec's `securitySchemes` are ignored for method selection.

### Example 4: API Key via Env Override (Query)

```bash
export ORCA_SPEC_ENDPOINT=https://api.example.com/spec
export ORCA_AUTH_METHOD=apikey
export ORCA_AUTH_APIKEY_NAME=api_key
export ORCA_AUTH_APIKEY_VALUE=your_api_key_value
export ORCA_AUTH_APIKEY_IN=query
```

Result:
- Auth method: `apikey` (from env override)
- Query param: `?api_key=your_api_key_value`
- No header is injected.

### Example 5: API Key via Env Override (Cookie)

```bash
export ORCA_SPEC_ENDPOINT=https://api.example.com/spec
export ORCA_AUTH_METHOD=apikey
export ORCA_AUTH_APIKEY_NAME=session_id
export ORCA_AUTH_APIKEY_VALUE=abc123xyz
export ORCA_AUTH_APIKEY_IN=cookie
```

Result:
- Auth method: `apikey` (from env override)
- Cookie: `Cookie: session_id=abc123xyz`

### Example 6: No Auth via Env Override

```bash
export ORCA_SPEC_ENDPOINT=https://api.example.com/spec
export ORCA_AUTH_METHOD=none
```

Result:
- Auth method: `none` (from env override)
- No headers or query params injected.
- The spec's `securitySchemes` are ignored for method selection.

### Example 7: Bearer Auth via Spec Inference

```bash
export ORCA_SPEC_ENDPOINT=https://api.example.com/spec
# No ORCA_AUTH_METHOD set
```

Spec:

```yaml
components:
  securitySchemes:
    BearerAuth:
      type: http
      scheme: bearer
```

Result:
- Auth method: `bearer` (inferred from spec)
- No env vars required; `bearerToken` is not populated.
- No `Authorization` header is injected.
- The remote service may reject unauthenticated requests.

### Example 8: API Key via Spec Inference

```bash
export ORCA_SPEC_ENDPOINT=https://api.example.com/spec
# No ORCA_AUTH_METHOD set
```

Spec:

```yaml
components:
  securitySchemes:
    ApiKeyAuth:
      type: apiKey
      name: X-API-Key
      in: header
```

Result:
- Auth method: `apikey` (inferred from spec)
- Since no `ORCA_AUTH_APIKEY_*` env vars are set, `apikeyName` and `apikeyValue` are not populated.
- No auth headers are injected.
- The remote service may reject unauthenticated requests.

## Error Conditions

| Condition | Error |
| --- | --- |
| `ORCA_AUTH_METHOD` set to an unsupported value | `ERROR: Unsupported auth method: <value>. Supported methods: none, bearer, basic, apikey` |
| `ORCA_AUTH_METHOD=bearer` and `ORCA_AUTH_BEARER_TOKEN` missing | `ERROR: ORCA_AUTH_BEARER_TOKEN is required when auth method is 'bearer'` |
| `ORCA_AUTH_METHOD=basic` and `ORCA_AUTH_BASIC_USERNAME` missing | `ERROR: ORCA_AUTH_BASIC_USERNAME is required when auth method is 'basic'` |
| `ORCA_AUTH_METHOD=basic` and `ORCA_AUTH_BASIC_PASSWORD` missing | `ERROR: ORCA_AUTH_BASIC_PASSWORD is required when auth method is 'basic'` |
| `ORCA_AUTH_METHOD=apikey` and `ORCA_AUTH_APIKEY_NAME` missing | `ERROR: ORCA_AUTH_APIKEY_NAME is required when auth method is 'apikey'` |
| `ORCA_AUTH_METHOD=apikey` and `ORCA_AUTH_APIKEY_VALUE` missing | `ERROR: ORCA_AUTH_APIKEY_VALUE is required when auth method is 'apikey'` |
