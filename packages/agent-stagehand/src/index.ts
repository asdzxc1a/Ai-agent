import type {
  AgentRuntime,
  AgentSession,
  OpenAgentSessionOptions
} from "@astra/agent-runtime";

import {
  createConfiguredStagehandRuntime,
  type StagehandRuntimeSettings
} from "./runtime-core.js";

export type {
  StagehandModelSettings,
  StagehandRuntimeSettings
} from "./runtime-core.js";

export class StagehandAgentRuntime implements AgentRuntime {
  readonly #runtime: AgentRuntime;

  public constructor(settings: StagehandRuntimeSettings) {
    this.#runtime = createConfiguredStagehandRuntime(settings);
  }

  public openSession(
    options: OpenAgentSessionOptions
  ): Promise<AgentSession> {
    return this.#runtime.openSession(options);
  }
}
