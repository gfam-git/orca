# Contributing to ORCa

All contributions are welcome! This guide covers the workflow, coding standards, and expectations for contributing to the ORCa project.

## Getting Started

Prior to working on the project you must:
1. Install Node.js, npm, and GIT. The Github CLI is recommended but not required.
2. Clone the repository if not already done.
3. Install project dependencies with `npm i`
4. Checkout a named branch to track your work. See [Branching and Naming](#branching-and-naming) for more information.

Follow the [Development Workflow](#development-workflow) detailed below until your work is complete, documented and tested.\
Finally, create a PR in Github to merge your branch into `main`. PR guidelines are documented below in [Pull Request Guidelines](#pull-request-guidelines).

## Branching and Naming

- Always work on a new branch off of `origin/main`.
- **Branch naming convention**: `<work-type>/<friendly-name>`
  - Examples: `feat/add-spec-endpoint-env-var`, `bug/fix-broken-endpoint-var`, `docs/update-contributing`
- Name branches after the **feature or fix**.

## Development Workflow

1. **Create a feature branch** from `main` using the naming convention above.
2. **Perform development work** while keeping documentation up-to-date.
3. **Run locally** with `npm run dev` to test changes before building.
4. **Write/update automated tests** in `src/tests/` and execute them alongside regression tests.
5. **Validate test output** and resolve any bugs introduced.
6. **Build the project** with `npm run build` and resolve any build errors.
7. **Verify the compiled build** via `npm run start`.
8. **Create a pull request** to merge your branch into `main`.

## Pull Request Guidelines

When creating a PR:

- Include links to related GitHub issues and/or other PRs.
- Provide a **summary of changes**.
- Include a **summary of test validation** (what tests cover, regression results).
- Ensure all CI checks pass (if applicable).

## Documentation

**Before making any changes, consult the `docs/` directory first.** The documentation is the authoritative reference for ORCa and should be your primary source of truth.

- **Read before writing:** Review existing docs to understand current conventions and patterns. Do not assume behavior that is not documented.
- **Update alongside code:** When you modify code, update the corresponding documentation. If a feature, type, function, or behavior changes, ensure the docs reflect the new state.
- **Keep INDEX.md current:** The `docs/INDEX.md` file should contain a list of all sub-directories and their purpose. When adding/updating sub-directories, keep this index up-to-date. **DO NOT list individual files here** — this is an index for the directory only.
- **Avoid stale documentation:** If a doc section becomes outdated due to code changes, update it or mark it as needing review. Never leave docs that contradict the actual implementation.

## Testing

**Before making any pull requests, ensure your modifications include new or modified tests in `src/tests/`.** This is imperative for maintaining a fully functional product and enabling regression testing.

- **Inventory and relate tests:** Review existing tests once development is complete and determine if any existing tests require modification. Update them as needed.
- **Validate and verify tests:** Execute the new/modified tests and ensure their output matches expectations.
- **Regression testing:** Execute all other unmodified tests and ensure they continue to function as expected. Report any regressions as GitHub issues.

## Code Style and Conventions

- **Language:** TypeScript (via the MCP TypeScript SDK).
- **Entry point:** The main entry point is `src/index.ts`.
- **Framework:** Built on `@modelcontextprotocol/typescript-sdk`. Familiarity with MCP server SDK patterns is essential.
- **Tests:** Automated tests should be written and maintained in `src/tests/`.

## Project Structure

```
|-- README.md              // Project details for non-agents (what is ORCa, why, getting started)
|-- AGENTS.md              // Project details for AI agents (how to interact with the codebase)
|-- CONTRIBUTING.md        // You are here — contribution guidelines
|-- src/                   // Source code for the ORCa implementation
|   |-- index.ts           // Entry point — exports and server bootstrap
|   |-- mcp/               // MCP server implementation
|   |   |-- tools/         // Tool implementations
|   |-- orc/               // ORC client implementation
|   |-- tests/             // Test suite
|   |   |-- mcp/           // MCP tool tests
|-- docs/                  // Top-level directory for all technical documentation
    |-- INDEX.md           // Index of all docs and sub-directories
    |-- .../               // Sub-directories and corresponding INDEX.md files as needed
```

Keep this structure up-to-date as the project evolves.

## Quick Links

- **Protocol overview:** See [docs/overview.md](docs/overview.md)
- **Protocol specification:** See [docs/protocol/](docs/protocol/)
- **Environment variables:** See [docs/reference/environment-variables.md](docs/reference/environment-variables.md)
- **Full documentation index:** See [docs/INDEX.md](docs/INDEX.md)
