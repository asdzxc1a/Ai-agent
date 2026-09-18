import type {
  AgentAction,
  AgentActionResult,
  AgentRuntime,
  AgentSession,
  OpenAgentSessionOptions,
  RuntimeSchema
} from "../src/index.js";

export class FakeAgentSession implements AgentSession {
  public readonly navigations: string[] = [];
  public readonly observedInstructions: string[] = [];
  public readonly actions: AgentAction[] = [];
  public closeCalls = 0;
  public extractionValue: unknown = {};

  public async navigate(url: string): Promise<void> {
    this.navigations.push(url);
  }

  public async observe(instruction: string): Promise<AgentAction[]> {
    this.observedInstructions.push(instruction);

    return [
      {
        selector: "xpath=//button",
        description: "Fixture button",
        method: "click",
        arguments: []
      }
    ];
  }

  public async act(action: AgentAction): Promise<AgentActionResult> {
    this.actions.push(action);

    return {
      success: true,
      message: "fake action completed",
      actionDescription: action.description,
      actions: [action]
    };
  }

  public async extract<T>(
    _instruction: string,
    schema: RuntimeSchema<T>
  ): Promise<T> {
    return schema.parse(this.extractionValue);
  }

  public async close(): Promise<void> {
    this.closeCalls += 1;
  }
}

export class FakeAgentRuntime implements AgentRuntime {
  public readonly openOptions: OpenAgentSessionOptions[] = [];
  public readonly sessions: FakeAgentSession[] = [];

  public async openSession(
    options: OpenAgentSessionOptions
  ): Promise<AgentSession> {
    this.openOptions.push(options);

    const session = new FakeAgentSession();
    this.sessions.push(session);
    return session;
  }
}
