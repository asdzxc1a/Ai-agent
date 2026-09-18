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

function findIncrementElementId(prompt: string): string {
  const lines = prompt.split(/\r?\n/);

  const targetLine = lines.find(
    (line) =>
      line.toLowerCase().includes("increment count") &&
      /\b\d+-\d+\b/.test(line)
  );

  const match = targetLine?.match(/\b(\d+-\d+)\b/);
  if (!match?.[1]) {
    throw new Error(
      "Fixture LLM could not find a real Stagehand encoded ID for the Increment count button."
    );
  }

  return match[1];
}

function extractFixtureState(prompt: string): {
  count: number;
  status: "idle" | "clicked";
} {
  const withoutEncodedIds = prompt.replace(/\[\d+-\d+\]/g, " ");
  const match = withoutEncodedIds.match(
    /RESULT\s+count=(\d+)\s+status=(idle|clicked)/i
  );

  if (!match?.[1] || !match[2]) {
    throw new Error(
      "Fixture LLM could not derive RESULT state from Stagehand's extraction prompt."
    );
  }

  return {
    count: Number(match[1]),
    status: match[2].toLowerCase() as "idle" | "clicked"
  };
}

function chooseStructuredData(
  responseModel: StructuredResponseModel,
  prompt: string
): unknown {
  let candidate: unknown;

  switch (responseModel.name) {
    case "Observation": {
      const elementId = findIncrementElementId(prompt);
      candidate = {
        elements: [
          {
            elementId,
            description: "Increment count button",
            method: "click",
            arguments: []
          }
        ]
      };
      break;
    }

    case "Extraction":
      candidate = extractFixtureState(prompt);
      break;

    case "Metadata":
      candidate = {
        progress: "The requested fixture state has been extracted.",
        completed: true
      };
      break;

    case "act":
      throw new Error(
        "Gate 2 must execute Stagehand's observed Action deterministically; an act inference call was unexpected."
      );

    default:
      throw new Error(
        `Fixture LLM does not support Stagehand response model "${responseModel.name}".`
      );
  }

  const result = responseModel.schema.safeParse(candidate);
  if (!result.success) {
    throw new Error(
      `Fixture LLM produced schema-invalid data for "${responseModel.name}": ${result.error.message}`
    );
  }

  return result.data;
}

export class FixtureLLMClient extends LLMClient {
  public override type = "fixture" as const;
  public override hasVision = false;
  public override clientOptions = {};

  public constructor() {
    super("fixture/deterministic" as AvailableModel);
  }

  public override async createChatCompletion<T>({
    options
  }: CreateChatCompletionOptions): Promise<T> {
    if (!options.response_model) {
      throw new Error(
        "Gate 2 fixture LLM only supports Stagehand structured inference calls."
      );
    }

    const data = chooseStructuredData(
      options.response_model,
      messageText(options.messages)
    );

    return {
      data,
      usage: zeroUsage
    } as T;
  }
}
