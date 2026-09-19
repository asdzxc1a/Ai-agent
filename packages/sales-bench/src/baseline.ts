import {
  selectConsultativeBaseline
} from "@astra/sales-domain";

import type { SalesBenchCandidate } from "./types.js";

export const BASELINE_0_CANDIDATE: SalesBenchCandidate = {
  id: "consultative-baseline-v0",
  kind: "deterministic",
  policyVersion: "consultative-baseline-v0",
  modelId: null,
  decide(input) {
    return selectConsultativeBaseline(input);
  }
};

export function createPinnedModelCandidate(input: {
  id: string;
  modelId: string;
  policyVersion: string;
  decide: SalesBenchCandidate["decide"];
}): SalesBenchCandidate {
  const modelId = input.modelId.trim();
  if (!modelId) {
    throw new TypeError("modelId is required for a pinned model candidate");
  }

  return {
    id: input.id,
    kind: "model",
    modelId,
    policyVersion: input.policyVersion,
    decide: input.decide
  };
}
