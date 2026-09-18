import type { LLMClient } from "@browserbasehq/stagehand";
import type { AgentRuntime } from "@astra/agent-runtime";

import { createStagehandRuntimeWithClient } from "./runtime-core.js";

export function createStagehandAgentRuntimeForTesting(
  createClient: () => LLMClient
): AgentRuntime {
  return createStagehandRuntimeWithClient(createClient);
}
