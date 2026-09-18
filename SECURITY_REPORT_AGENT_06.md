# SECURITY REPORT — AGENT 06

Base under attack: `eca76285822bde5f8130f546b176b03eca6c03e6`

Test suite: `test/security/action-execution-security.test.mjs`

| # | Attack attempted | Result / expected integration result | Severity if broken | Recommended fix |
|---|---|---|---|---|
| 1 | Execute pending proposal | Blocked by explicit-confirmation transition | Critical | Keep confirmation check in server-owned store |
| 2 | Execute cancelled pending proposal | Blocked | Critical | Never treat cancelled as confirmed |
| 3 | Execute another session's proposal | Hidden as not found | Critical | Always scope lookup by server session |
| 4 | Confirm another session's proposal | Rejected with session mismatch | Critical | Preserve session-scoped confirm |
| 5 | Promise-level simultaneous double execute | Provider runs at most once | Critical | Keep synchronous beginExecution transition before provider await |
| 6 | HTTP retry after success | Returns stored executed result; provider not rerun | Critical | Preserve executed replay idempotency |
| 7 | Tool throws after execution begins | Proposal records failed, not executed | High | Record failure after provider exception |
| 8 | Replay after failure | Provider not rerun automatically | High | Require explicit recovery policy before retries |
| 9 | Model submits `executed:true` | Canonicalizer discards claim | Critical | Keep execution state server-owned |
| 10 | Model submits fake URL/calendar slot | Canonicalizer discards fields | Critical | Never navigate or execute model URLs |
| 11 | Malicious receipt with secrets/nested payload | Executor sanitizes persisted receipt | Critical | Keep receipt allowlist at executor and audit boundaries |
| 12 | Unknown action type | Rejected before persistence | High | Maintain action-kind allowlist |
| 13 | Malformed proposal ID | Not found; provider untouched | High | Keep opaque server IDs and exact lookup |
| 14 | Concurrent buyer isolation | Buyers execute only their own proposals | Critical | Preserve session-scoped lookup throughout |
| 15 | 25 simultaneous proposals | Independent execution; no shared-state collapse | High | Keep per-proposal transitions atomic in-process |
| 16 | Confirm after renderer shutdown | Allowed by current retained learning-session contract | Medium | Document contract; if undesired, delete retained mapping on stop |
| 17 | Confirmed then cancelled action execute | Blocked | Critical | Cancellation must be terminal for this wave |
| 18 | No handler configured | Fails closed with tool unavailable | Critical | Never fall back to a generic tool |
| 19 | Sandbox attempts real network | Network tripwire remains untouched | Critical | Keep sandbox providers local-only |
| 20 | Direct SalesOS secret/receipt/error injection | **Frozen base defect:** receipt was cloned wholesale; post-Agent-3 review also found provider error text needs a safe audit representation | Critical | Independently allowlist receipt fields and never persist raw provider error text in SalesOS |

## Failing tests on the frozen base

Case 20 is intentionally expected to fail against the frozen base because `SalesOSHarness` cloned arbitrary receipt fields. After Agent 3 receipt hardening, the expanded case also checks that provider error text such as authorization material cannot enter the learning bundle.

The Integration Captain should use a server-owned generic failure reason or another strict allowlist for SalesOS action failures; raw provider exception messages must not be treated as audit-safe.

## Security conclusion

The highest-risk invariants are explicit human confirmation, session isolation, at-most-once execution, fail-closed tool selection, and independent audit sanitization for both receipts and failures. The QA branch changes tests/reporting only; it does not modify production code.
