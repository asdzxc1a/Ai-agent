# Gate 13 delivery-cost ceiling rationale

**Frozen ceiling:** **$10.00 USD per brief**

This is an acceptance ceiling, not a target production COGS forecast.

The accounting plan deliberately uses an upper-bound model rate because Astra's durable Stagehand usage snapshot is aggregate and does not yet retain enough per-request billing detail to prove that every call remained under OpenAI's >272K long-context threshold or whether cache writes occurred. Every prompt token is therefore charged at $10 per million (the $8/M long-context input rate multiplied by the documented 1.25x cache-write factor), and every completion token is charged at the $30/M long-context output rate. Actual short-context/cached spend can be lower; the acceptance accounting is intentionally allowed to overstate rather than understate cost.

With that conservative plan, a brief consuming 500,000 prompt tokens, 50,000 output tokens, and 30 minutes of browser runtime accounts for **$6.6664**: $5.00 model input + $1.50 model output + $0.1664 browser reference compute. The $10 ceiling leaves operational headroom while still bounding obviously inefficient runs.

The ceiling is frozen before the measured cohort so it cannot be raised after seeing expensive runs. Human preparation/review labor is deliberately not hidden in this infrastructure/model number: Gate 13 measures human time separately and requires at least a 50% median reduction versus the measured normal-tools human baseline.
