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

const TARGET_ACTIONS = [
  "continue research",
  "open research evidence",
  "load research evidence",
  "reveal loaded research evidence"
] as const;

function observation(prompt: string): unknown {
  const lines = prompt.split(/\r?\n/);

  for (const label of TARGET_ACTIONS) {
    const line = lines.find((candidate) =>
      candidate.toLowerCase().includes(label) &&
      /\b\d+-\d+\b/.test(candidate)
    );
    const id = line?.match(/\b(\d+-\d+)\b/)?.[1];

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

  return { elements: [] };
}

function parseJsonMarkers(
  prompt: string,
  marker: string
): unknown[] {
  const values: unknown[] = [];
  for (const line of prompt.split(/\r?\n/)) {
    const index = line.indexOf(marker);
    if (index < 0) continue;

    const raw = line.slice(index + marker.length).trim();
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start < 0 || end < start) continue;

    try {
      values.push(JSON.parse(raw.slice(start, end + 1)));
    } catch {
      // Ignore malformed page text rather than treating it as evidence.
    }
  }
  return values;
}

function extraction(prompt: string): unknown {
  const sources = parseJsonMarkers(prompt, "BENCH_SOURCE");
  const source = sources.find((value) =>
    typeof value === "object" &&
    value !== null &&
    "pageId" in value
  ) as { pageId?: unknown } | undefined;

  if (typeof source?.pageId !== "string") {
    throw new Error("ResearchBench fixture found no source marker.");
  }

  const facts = parseJsonMarkers(prompt, "BENCH_FACT").filter(
    (value): value is {
      field: string;
      value: string;
      publishedAt?: string;
    } => {
      if (typeof value !== "object" || value === null) return false;
      const record = value as Record<string, unknown>;
      return (
        typeof record.field === "string" &&
        typeof record.value === "string" &&
        (
          record.publishedAt === undefined ||
          typeof record.publishedAt === "string"
        )
      );
    }
  );

  const unknownFields = parseJsonMarkers(
    prompt,
    "BENCH_UNKNOWN"
  ).flatMap((value) => {
    if (
      typeof value === "object" &&
      value !== null &&
      "field" in value &&
      typeof (value as { field?: unknown }).field === "string"
    ) {
      return [(value as { field: string }).field];
    }
    return [];
  });

  return {
    sourcePage: source.pageId,
    facts,
    unknownFields
  };
}

function chooseStructuredData(
  responseModel: StructuredResponseModel,
  prompt: string
): unknown {
  let candidate: unknown;

  switch (responseModel.name) {
    case "Observation":
      candidate = observation(prompt);
      break;
    case "Extraction":
      candidate = extraction(prompt);
      break;
    case "Metadata":
      candidate = {
        progress: "ResearchBench fixture processed.",
        completed: true
      };
      break;
    case "act":
      throw new Error(
        "ResearchBench executes only previously observed actions."
      );
    default:
      throw new Error(
        "Unsupported ResearchBench response model: " +
        responseModel.name
      );
  }

  const result = responseModel.schema.safeParse(candidate);
  if (!result.success) {
    throw new Error(
      "ResearchBench fixture schema error for " +
      responseModel.name + ": " + result.error.message
    );
  }
  return result.data;
}

export class ResearchBenchFixtureLLMClient extends LLMClient {
  public override type = "fixture" as const;
  public override hasVision = false;
  public override clientOptions = {};

  public constructor() {
    super("fixture/research-bench-v1" as AvailableModel);
  }

  public override async createChatCompletion<T>({
    options
  }: CreateChatCompletionOptions): Promise<T> {
    if (!options.response_model) {
      throw new Error(
        "ResearchBench fixture requires structured inference."
      );
    }

    return {
      data: chooseStructuredData(
        options.response_model,
        messageText(options.messages)
      ),
      usage: zeroUsage
    } as T;
  }
}
