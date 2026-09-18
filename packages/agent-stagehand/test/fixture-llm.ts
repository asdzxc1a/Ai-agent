import {
  LLMClient,
  type AvailableModel,
  type CreateChatCompletionOptions
} from "@browserbasehq/stagehand";

const zeroUsage = {
  prompt_tokens: 0,
  completion_tokens: 0,
  total_tokens: 0
} as const;

type StructuredResponseModel = NonNullable<
  CreateChatCompletionOptions["options"]["response_model"]
>;

function messageText(
  messages: CreateChatCompletionOptions["options"]["messages"]
): string {
  const chunks: string[] = [];

  for (const message of messages) {
    if (typeof message.content === "string") {
      chunks.push(message.content);
      continue;
    }

    for (const part of message.content) {
      if ("text" in part && typeof part.text === "string") {
        chunks.push(part.text);
      }
    }
  }

  return chunks.join("\n");
}

function findIncrementElementId(prompt: string): string | undefined {
  const lines = prompt.split(/\r?\n/);

  for (const line of lines) {
    if (!line.toLowerCase().includes("increment count")) {
      continue;
    }

    const match = line.match(/\[(\d+-\d+)\]/);
    if (match?.[1]) {
      return match[1];
    }
  }

  const fallback = prompt.match(/\[(\d+-\d+)\][\s\S]{0,240}?increment count/i);
  return fallback?.[1];
}

function responseCandidates(elementId: string): unknown[] {
  const action = {
    elementId,
    description: "Increment count button",
    method: "click",
    arguments: []
  };

  return [
    {
      elements: [action]
    },
    {
      action,
      twoStep: false
    },
    {
      element: action,
      twoStep: false
    },
    {
      count: 1,
      status: "clicked"
    },
    {
      value: {
        count: 1,
        status: "clicked"
      }
    },
    {
      progress: "The requested fixture state has been extracted.",
      completed: true
    },
    {
      completed: true,
      progress: "The requested fixture state has been extracted."
    },
    {
      count: 1,
      status: "clicked",
      metadata: {
        completed: true
      }
    },
    {
      metadata: {
        progress: "The requested fixture state has been extracted.",
        completed: true
      }
    }
  ];
}

function chooseStructuredData(
  responseModel: StructuredResponseModel,
  prompt: string
): unknown {
  const elementId = findIncrementElementId(prompt) ?? "0-1";

  for (const candidate of responseCandidates(elementId)) {
    const result = responseModel.schema.safeParse(candidate);
    if (result.success) {
      return result.data;
    }
  }

  throw new Error(
    `Fixture LLM has no schema-valid response for Stagehand model "${responseModel.name}".`
  );
}

export class FixtureLLMClient extends LLMClient {
  public type = "fixture" as const;

  public constructor() {
    super("openai/gpt-4o" as AvailableModel);
  }

  public async createChatCompletion<T>({
    options
  }: CreateChatCompletionOptions): Promise<T> {
    if (options.response_model) {
      const data = chooseStructuredData(
        options.response_model,
        messageText(options.messages)
      );

      return {
        data,
        usage: zeroUsage
      } as T;
    }

    return {
      id: "fixture-completion",
      object: "chat.completion",
      created: 0,
      model: "fixture/deterministic",
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            content: "",
            tool_calls: []
          },
          finish_reason: "stop"
        }
      ],
      usage: zeroUsage
    } as T;
  }
}
