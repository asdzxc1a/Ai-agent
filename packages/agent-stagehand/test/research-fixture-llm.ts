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

const ACTION_LABELS = [
  "open company profile",
  "open operations evidence",
  "finish research"
] as const;

function observation(
  prompt: string
): unknown {
  if (
    prompt.includes(
      "RESEARCH_RESULT"
    )
  ) {
    return {
      elements: []
    };
  }

  const lines =
    prompt.split(/\r?\n/);

  for (
    const label of ACTION_LABELS
  ) {
    const line =
      lines.find(
        (candidate) =>
          candidate
            .toLowerCase()
            .includes(label) &&
          /\b\d+-\d+\b/.test(
            candidate
          )
      );
    const id =
      line?.match(
        /\b(\d+-\d+)\b/
      )?.[1];

    if (id !== undefined) {
      return {
        elements: [
          {
            elementId: id,
            description: label,
            method: "click",
            arguments: []
          }
        ]
      };
    }
  }

  throw new Error(
    "Research fixture LLM found no expected action."
  );
}

function extraction(
  prompt: string
): unknown {
  const cleaned =
    prompt.replace(
      /\[\d+-\d+\]/g,
      " "
    );
  const match =
    cleaned.match(
      /RESEARCH_RESULT\s+company=([^\s]+)\s+workflow=([^\s]+)\s+status=(complete)/i
    );

  if (
    match?.[1] === undefined ||
    match[2] === undefined ||
    match[3] === undefined
  ) {
    throw new Error(
      "Research fixture LLM could not derive final result."
    );
  }

  return {
    company: match[1],
    workflow: match[2],
    status:
      match[3].toLowerCase()
  };
}

function chooseStructuredData(
  responseModel:
    StructuredResponseModel,
  prompt: string
): unknown {
  let candidate: unknown;

  switch (responseModel.name) {
    case "Observation":
      candidate =
        observation(prompt);
      break;

    case "Extraction":
      candidate =
        extraction(prompt);
      break;

    case "Metadata":
      candidate = {
        progress:
          "Research fixture processed.",
        completed: true
      };
      break;

    case "act":
      throw new Error(
        "Research fixture must execute observed actions directly."
      );

    default:
      throw new Error(
        "Unsupported response model: " +
          responseModel.name
      );
  }

  const result =
    responseModel.schema.safeParse(
      candidate
    );

  if (!result.success) {
    throw new Error(
      "Research fixture schema error for " +
        responseModel.name +
        ": " +
        result.error.message
    );
  }

  return result.data;
}

export class ResearchFixtureLLMClient
  extends LLMClient {
  public override type =
    "fixture" as const;
  public override hasVision = false;
  public override clientOptions = {};

  public constructor() {
    super(
      "fixture/research-deterministic" as AvailableModel
    );
  }

  public override async createChatCompletion<T>({
    options
  }: CreateChatCompletionOptions): Promise<T> {
    if (!options.response_model) {
      throw new Error(
        "Research fixture requires structured inference."
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
