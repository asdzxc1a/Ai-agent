# SalesOS harness

SalesOS is the vendor-neutral learning/control layer around the existing Qwen + GPT-Live + HeyGen realtime stack.

## Boundary

The live path remains optimized for latency and deterministic commercial truth:

```text
buyer -> GPT-Live/Qwen realtime -> SalesBackendAdapter -> reasoner -> HeyGen
```

SalesOS observes that path without becoming a second salesperson:

```text
SalesBackendAdapter --------┐
                            ├-> SalesOSHarness -> trajectory store -> learning bundle
QwenHeyGenBridge -----------┘                        |
                                                     +-> evaluator/reward
                                                     +-> experience bank
                                                     +-> future CustomerLM / counterfactual branching
                                                     +-> future AReaL / GRPO / SPEAR / RLSTA exporters
```

## Contracts

### `salesos.event.v1`
Append-only structured trajectory events. Raw PCM audio is intentionally excluded.

### `salesos.reward.v1`
Multi-component reward vector. `factuality` and `compliance` are hard gates; a trajectory is not training-eligible until both are scored above threshold.

### `salesos.experience.v1`
Explicitly promoted reusable experience: state + strategy + outcome + reward + evidence references.

### `salesos.learning-bundle.v1`
Portable per-session export containing trajectory, rewards, and promoted experiences. Training frameworks consume this bundle; the live runtime does not depend on any one RL framework.

## Design rules

1. DeepSeek/Qwen/GLM remain interchangeable behind the existing reasoner contract.
2. GPT-Live and HeyGen remain transport/rendering concerns, not owners of sales policy.
3. The harness stores structured decisions and observable outputs, never hidden chain-of-thought.
4. Raw audio is not placed in the learning event stream; transcripts and interruption events are enough for policy learning.
5. Training frameworks plug into exported learning bundles later. Do not put GRPO/AReaL/SPEAR code on the realtime hot path.
6. Production calls are collected first, evaluated offline, then admitted to training only after hard gates pass.
