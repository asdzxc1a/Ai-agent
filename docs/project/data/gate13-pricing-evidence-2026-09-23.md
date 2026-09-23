# Gate 13 pricing evidence

**As of:** 2026-09-23  
**Purpose:** source record for the pre-result Gate 13 acceptance cost plan

## Model

Selected model: `openai/gpt-5.6-sol`.

OpenAI's API pricing page listed GPT-5.6 Sol standard short-context pricing at:

- input: **$4.00 / 1M tokens**;
- cached input: **$0.40 / 1M tokens**;
- output: **$20.00 / 1M tokens**.

Source: https://developers.openai.com/api/docs/pricing

The Gate 13 cost plan intentionally charges all Stagehand `promptTokens` at the full $4/M input rate rather than trying to subtract `cachedInputTokens`. In the pinned AI SDK mapping, cached input is a subset of provider input usage; the conservative treatment can overstate cost but cannot create a false cost pass through an unverified subtraction.

The plan charges Stagehand `completionTokens` once at the output price and does not add a separate reasoning-token component. In the pinned OpenAI AI SDK mapping, provider `output_tokens` is the output total and `reasoning_tokens` is separately exposed as a subset.

## Self-hosted browser allocation

Gate 13 does not use managed Steel Cloud pricing. To keep self-hosted browser infrastructure non-zero and reproducible, the cost plan uses an explicit reference-compute allocation:

- reference instance: AWS EC2 `t3.2xlarge`;
- reference region/pricing basis: On-Demand, `us-east-1`;
- documented hourly price: **$0.3328/hour**;
- Gate 13 meter: server-derived `RUN_DURATION_MS`, proportional with no rounding.

Source: https://docs.aws.amazon.com/prescriptive-guidance/latest/optimize-costs-microsoft-workloads/right-size-selection.html

This is an accounting reference, not a claim that the measured browser process physically runs on AWS.
