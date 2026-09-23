# Gate 13 first acceptance authorization and sample freeze

**Date:** 2026-09-23  
**Gate:** 13  
**Research executed:** none  
**Measured Astra attempts consumed:** 0

## Explicit authorization

The user explicitly authorized all 43 targets in:

- manifest ID: `g13-us-transportation-approval-candidates-2026-09-20`;
- SHA-256: `9b050c12d784f8476ca0f80cbdb9e425b634b9d2c484730ac1617c025dcec109`;
- scope: frozen Gate 13 read-only acceptance protocol;
- exclusions: none.

The guarded atomic approval command was then executed against the exact checked-in manifest.

Durable result:

- approval batch ID: `g13-us-transportation-approval-2026-09-23-v1`;
- approved by: `asdzxc1a`;
- server-owned approvedAt: `2026-09-23T22:16:59.658Z`;
- targets: 43;
- all target approvals share the same server-owned approval timestamp;
- source manifest ID/SHA match the authorized bytes exactly.

## Acceptance sample freeze

A mutation-free sample preview reconstructed the sample from the canonical manifest, frozen universe, stored approval batch, and PR #106 packet. The complete universe was then frozen with no exclusions.

Durable result:

- sample ID: `g13-us-transportation-acceptance-2026-09-23-v1`;
- protocol: `gate13-measured-research-v7`;
- purpose: `ACCEPTANCE`;
- selection strategy: `COMPLETE_UNIVERSE`;
- target count: 43;
- server-owned frozenAt: `2026-09-23T22:17:42.076Z`;
- model: `openai/gpt-5.6-sol`;
- delivery-cost ceiling: $10/brief;
- frozen packet: `docs/project/data/gate13-acceptance-packet-2026-09-23.json`.

## Post-freeze verification

Direct PostgreSQL verification showed:

- approval batches: exact authorized batch present;
- approved targets in batch: 43;
- sample targets: 43;
- measured-human baselines: 0;
- measured-run reservations: 0;
- reviewed outcomes: 0.

Read-only operator verification showed:

- `acceptance-readiness.nextTransition = RECORD_MEASURED_HUMAN_BASELINES`;
- baseline count = 0/43;
- `acceptance-worklist` reports 43/43 targets at `RECORD_MEASURED_HUMAN_BASELINE`;
- no target has a reserved run ID, attempt ID, or outcome ID.

A custom-format PostgreSQL checkpoint was taken immediately after freeze:

- SHA-256: `e7e2ad0e917ca651813ae0db9d3fcbddc0b88a3296f65c7a985ec7e24b1f3e8e`.

The checkpoint itself is local operator state and is intentionally not committed to Git.

## Next experimental transition

Complete the normal-tools measured-human baseline for all 43 frozen targets before exposing the human researcher to any measured Astra output. Each baseline must be recorded durably before that target may reserve/start its one allowed measured Astra run.

Do not fabricate, estimate after the fact, or reuse calibration timings. No Astra first attempt should be consumed until the corresponding measured-human baseline exists.
