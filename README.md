# Astra Web Agent Platform

This repository is the working home for a clean-room, TinyFish-like web-agent platform.

## Fresh agent? Start here

**Astra and any new coding agent should read:**

1. [AGENTS.md](./AGENTS.md)
2. [Current project state](./docs/project/STATE.md)
3. The active gate in [Build plan](./docs/project/PLAN.md)
4. [Test strategy](./docs/project/TEST_STRATEGY.md)

Do not start by reading every historical document.

## What we are building

The initial architecture is intentionally small:

```text
Our API
  ↓
Our durable run engine
  ↓
Stagehand
  ↓ CDP
Steel Browser
  ↓
Chromium
```

After this works reliably, the same browser runtime is placed inside an E2B/Firecracker sandbox.

We deliberately **do not** merge or fork Stagehand, Steel, and E2B. They remain replaceable layers behind our own contracts.

## Persistent project memory

- [CHARTER.md](./docs/project/CHARTER.md) — why the project exists and long-term architecture.
- [STATE.md](./docs/project/STATE.md) — small, current source of truth.
- [PLAN.md](./docs/project/PLAN.md) — gated roadmap and acceptance tests.
- [DECISIONS.md](./docs/project/DECISIONS.md) — append-only architecture decisions.
- [LESSONS.md](./docs/project/LESSONS.md) — append-only reusable mistakes/insights.
- [TEST_STRATEGY.md](./docs/project/TEST_STRATEGY.md) — what counts as evidence.
- [HANDOFF_PROTOCOL.md](./docs/project/HANDOFF_PROTOCOL.md) — how fresh Astra contexts continue safely.

## Core rule

**One gate at a time. A gate does not pass until its automated acceptance tests pass.**

The immediate next action is always recorded in [STATE.md](./docs/project/STATE.md).


## Development

Gate 0 pins the foundation to:

- Node.js `24.21.0`
- pnpm `10.34.5`
- TypeScript `6.0.3`

From a clean checkout:

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Or run the same validation sequence with:

```bash
pnpm check
```

GitHub Actions runs the strict frozen-lockfile path on every push and pull request.


## Browser foundation

Gate 1 proves Steel independently of Stagehand.

The tested Steel image is pinned in:

```text
infra/steel-image.txt
```

The permanent integration test:

1. starts the deterministic fixture;
2. starts pinned Steel in Docker;
3. creates a Steel browser session through REST;
4. connects `playwright-core` over Steel's returned CDP WebSocket;
5. navigates, clicks, verifies state, and captures a screenshot;
6. releases the session;
7. repeats the complete sequence ten times.

Run the browser acceptance test when Steel and the fixture are already available:

```bash
pnpm test:steel
```

GitHub Actions performs the full Docker-backed setup in `.github/workflows/steel-integration.yml`.
