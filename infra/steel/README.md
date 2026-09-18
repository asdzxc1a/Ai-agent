# Local Steel runtime

The committed image is pinned by immutable GHCR digest.

Digest resolution date: **2026-09-18**

Source image:

```text
ghcr.io/steel-dev/steel-browser@sha256:58fc8f1ed309a647ea7e7a53005b90cb239b8995698d195a261654ac8804974c
```

Start:

```bash
docker compose -f infra/steel/compose.yaml up -d
```

Run the Gate 1 integration test:

```bash
pnpm test:steel
```

Stop and remove the service:

```bash
docker compose -f infra/steel/compose.yaml down -v
```

The integration test waits for `/v1/health`; do not add fixed startup sleeps.
