# Gate 13 pricing evidence

**As of:** 2026-09-23  
**Purpose:** source record for the pre-result Gate 13 acceptance cost plan

## Model

Selected model: `openai/gpt-5.6-sol`.

OpenAI's API pricing page listed GPT-5.6 Sol standard pricing at:

- short-context input: **$4.00 / 1M tokens**;
- short-context cached input: **$0.40 / 1M tokens**;
- short-context output: **$20.00 / 1M tokens**;
- for prompts with **>272K input tokens**, the full request is billed at **2x input** and **1.5x output**, i.e. **$8.00 / 1M input** and **$30.00 / 1M output**;
- cache writes are billed at **1.25x** the uncached input-token rate.

Source: https://developers.openai.com/api/docs/pricing

Gate 13's durable Stagehand usage is aggregate across model calls. It does not currently preserve enough per-request billing detail to prove which individual call crossed the >272K threshold or incurred a cache write. The frozen accounting therefore prices **every** `promptTokens` unit at **$10/M**, which is 1.25 x the $8/M long-context uncached input rate. This is an intentional upper bound: it may overstate actual input cost but avoids a false cost pass caused by assuming short-context/cache-discount conditions that cannot be reconstructed from durable evidence.

The plan prices every Stagehand `completionTokens` unit at the **$30/M long-context output rate** and does not add a separate reasoning-token component. In the pinned OpenAI AI SDK mapping, provider `output_tokens` is the output total and `reasoning_tokens` is separately exposed as a subset.

## Self-hosted browser allocation

Gate 13 does not use managed Steel Cloud pricing. To keep self-hosted browser infrastructure non-zero and reproducible, the cost plan uses an explicit reference-compute allocation:

- reference instance: AWS EC2 `t3.2xlarge`;
- reference region/pricing basis: On-Demand, `us-east-1`;
- documented hourly price: **$0.3328/hour**;
- Gate 13 meter: server-derived `RUN_DURATION_MS`, proportional with no rounding.

Source: https://docs.aws.amazon.com/prescriptive-guidance/latest/optimize-costs-microsoft-workloads/right-size-selection.html

This is an accounting reference, not a claim that the measured browser process physically runs on AWS.
