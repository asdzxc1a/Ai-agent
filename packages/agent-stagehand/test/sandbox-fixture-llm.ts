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

type StructuredResponseModel =
  NonNullable<
    CreateChatCompletionOptions[
      "options"
    ]["response_model"]
  >;

function messageText(
  messages:
    CreateChatCompletionOptions[
      "options"
    ]["messages"]
): string {
  const chunks: string[] = [];

  for (const message of messages) {
    if (
      typeof message.content ===
      "string"
    ) {
      chunks.push(
        message.content
      );
      continue;
    }

    for (
      const part of message.content
    ) {
      if (
        "text" in part &&
        typeof part.text ===
          "string"
      ) {
        chunks.push(part.text);
      }
    }
  }

  return chunks.join("\n");
}

function sandboxState(
  prompt: string
): {
  cookie: "set" | "missing";
  storage: "set" | "missing";
} {
  const cleaned =
    prompt.replace(
      /\[\d+-\d+\]/g,
      " "
    );
  const match =
    cleaned.match(
      /SANDBOX_STATE\s+cookie=(set|missing)\s+storage=(set|missing)/i
    );

  if (
    match?.[1] === undefined ||
    match[2] === undefined
  ) {
    throw new Error(
      "Sandbox fixture LLM could not derive visible state."
    );
  }

  return {
    cookie:
      match[1].toLowerCase() as
        | "set"
        | "missing",
    storage:
      match[2].toLowerCase() as
        | "set"
        | "missing"
  };
}

function chooseStructuredData(
  responseModel:
    StructuredResponseModel,
  prompt: string
): unknown {
  let candidate: unknown;

  switch (responseModel.name) {
    case "Extraction":
      candidate =
        sandboxState(prompt);
      break;
    case "Observation":
      candidate = {
        elements: []
      };
      break;
    case "Metadata":
      candidate = {
        progress:
          "Sandbox fixture state extracted.",
        completed: true
      };
      break;
    case "act":
      throw new Error(
        "Sandbox isolation fixture does not use inferred actions."
      );
    default:
      throw new Error(
        "Unsupported sandbox fixture response model: " +
          responseModel.name
      );
  }

  const result =
    responseModel.schema.safeParse(
      candidate
    );

  if (!result.success) {
    throw new Error(
      "Sandbox fixture schema error for " +
        responseModel.name +
        ": " +
        result.error.message
    );
  }

  return result.data;
}

export class SandboxFixtureLLMClient
  extends LLMClient {
  public override type =
    "fixture" as const;
  public override hasVision = false;
  public override clientOptions = {};

  public constructor() {
    super(
      "fixture/sandbox-deterministic" as AvailableModel
    );
  }

  public override async createChatCompletion<T>({
    options
  }: CreateChatCompletionOptions): Promise<T> {
    if (!options.response_model) {
      throw new Error(
        "Sandbox fixture requires structured inference."
      );
    }

    return {
      data: chooseStructuredData(
        options.response_model,
        messageText(
          options.messages
        )
      ),
      usage: zeroUsage
    } as T;
  }
}
