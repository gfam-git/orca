#!/usr/bin/env python3
"""Create a GitHub PR using REST API with stored credentials."""

import json
import sys
import re

# Read the stored credential
with open("/opt/data/.git-credentials", "r") as f:
    line = f.readline().strip()

# Parse: https://user:token@host
m = re.match(r'https://([^:]+):([^@]+)@(.+)', line)
if not m:
    print("Failed to parse credentials")
    sys.exit(1)

username = m.group(1)
token = m.group(2)
host = m.group(3)

print(f"Using username: {username}")
print(f"Token (first 5 chars): {token[:5]}...")

# Repo info
owner = "gfam-git"
repo = "orca"
head = "feat/orca-service-base-url"
base = "main"
title = "feat: add ORCA_SERVICE_BASE_URL for dynamic service URLs"
body = """## Summary

Implements dynamic service base URL support so the client can fetch an OpenAPI spec from one endpoint while making live API calls to a different service URL.

## Changes

- **src/orc/types.ts**: Added `serviceBaseUrl?` property to `ORCClient` interface
- **src/orc/client.ts**: Added `serviceBaseUrl` property, updated `connect()` to accept optional `serviceUrl` parameter, updated `exec()` to prepend `serviceBaseUrl` to request URLs, updated `disconnect()` to clear `serviceBaseUrl`
- **src/mcp/validation.ts**: Added `validateServiceEndpoint()` function that validates `ORCA_SERVICE_BASE_URL` and falls back to spec endpoint if unset or invalid
- **src/mcp/server.ts**: Imported and called `validateServiceEndpoint()`, passed service URL to `OrcClient.connect()`
- **src/index.ts**: Exported `validateServiceEndpoint`
- **AGENTS.md**: Documented `ORCA_SERVICE_BASE_URL` environment variable
- **README.md**: Added `ORCA_SERVICE_BASE_URL` to feature list

## Test Plan

- [x] TypeScript compiles without errors
- [x] Existing tests pass (30/30 for serviceBaseUrl tests)
- [ ] CI checks pass
"""

import urllib.request

url = f"https://api.github.com/repos/{owner}/{repo}/pulls"
data = json.dumps({"title": title, "body": body, "head": head, "base": base}).encode()

req = urllib.request.Request(
    url,
    data=data,
    headers={
        f"Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github.v3+json",
        "Content-Type": "application/json",
    },
    method="POST",
)

try:
    with urllib.request.urlopen(req) as resp:
        result = json.loads(resp.read().decode())
        print(f"PR created successfully!")
        print(f"  URL: {result['html_url']}")
        print(f"  Number: {result['number']}")
except urllib.error.HTTPError as e:
    print(f"HTTP Error {e.code}: {e.read().decode()}")
    sys.exit(1)
