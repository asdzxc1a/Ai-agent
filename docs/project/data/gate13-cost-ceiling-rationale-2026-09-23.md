# Gate 13 delivery-cost ceiling rationale

**Frozen ceiling:** **$5.00 USD per brief**

This is an acceptance ceiling, not a target production COGS forecast.

The ceiling is intentionally conservative so Gate 13 tests research quality and human-time reduction without being tuned to a fragile token estimate. Under the frozen cost plan, GPT-5.6 Sol costs $4 per million input tokens and $20 per million output tokens, while the self-hosted browser allocation is $0.3328 per reference compute hour. A brief consuming 500,000 input tokens, 50,000 output tokens, and 30 minutes of browser runtime would account for about $3.17, leaving material headroom before the $5 ceiling.

The ceiling is frozen before the measured cohort so it cannot be raised after seeing expensive runs. Human preparation/review labor is deliberately not hidden in this infrastructure/model number: Gate 13 measures human time separately and requires at least a 50% median reduction versus the measured normal-tools human baseline.
