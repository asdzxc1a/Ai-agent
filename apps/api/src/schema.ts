import { z } from "zod";

import type { RuntimeSchema } from "@astra/agent-runtime";
import type {
  CreateRunRequest,
  ObjectOutputSchema,
  OutputPropertySchema
} from "@astra/contracts";

export type ApiInputErrorCode =
  | "INVALID_REQUEST"
  | "UNSUPPORTED_OUTPUT_SCHEMA";

export class ApiInputError extends Error {
  public readonly code: ApiInputErrorCode;

  public constructor(code: ApiInputErrorCode, message: string) {
    super(message);
    this.name = "ApiInputError";
    this.code = code;
  }
}

const requestEnvelopeSchema = z.object({
  url: z.string().min(1),
  goal: z.string().trim().min(1),
  outputSchema: z.unknown().optional()
}).strict();

const outputPropertySchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("string"),
    const: z.string().optional()
  }).strict(),
  z.object({
    type: z.literal("number"),
    const: z.number().optional()
  }).strict(),
  z.object({
    type: z.literal("boolean"),
    const: z.boolean().optional()
  }).strict()
]);

const objectOutputSchema = z.object({
  type: z.literal("object"),
  properties: z.record(z.string(), outputPropertySchema),
  required: z.array(z.string()).optional(),
  additionalProperties: z.literal(false).optional()
}).strict().superRefine((schema, context) => {
  for (const required of schema.required ?? []) {
    if (!(required in schema.properties)) {
      context.addIssue({
        code: "custom",
        message: `required property "${required}" is not declared in properties`
      });
    }
  }
});

function messageFromZod(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Invalid input.";
}

function normalizeProperty(
  property: z.infer<typeof outputPropertySchema>
): OutputPropertySchema {
  switch (property.type) {
    case "string":
      return property.const === undefined
        ? { type: "string" }
        : {
            type: "string",
            const: property.const
          };
    case "number":
      return property.const === undefined
        ? { type: "number" }
        : {
            type: "number",
            const: property.const
          };
    case "boolean":
      return property.const === undefined
        ? { type: "boolean" }
        : {
            type: "boolean",
            const: property.const
          };
  }
}

function normalizeOutputSchema(
  schema: z.infer<typeof objectOutputSchema>
): ObjectOutputSchema {
  const properties: Record<string, OutputPropertySchema> = {};

  for (const [name, property] of Object.entries(schema.properties)) {
    properties[name] = normalizeProperty(property);
  }

  return {
    type: "object",
    properties,
    ...(schema.required === undefined
      ? {}
      : {
          required: [...schema.required]
        }),
    ...(schema.additionalProperties === undefined
      ? {}
      : {
          additionalProperties: false
        })
  };
}


export function parseCreateRunRequest(input: unknown): CreateRunRequest {
  const envelope = requestEnvelopeSchema.safeParse(input);

  if (!envelope.success) {
    throw new ApiInputError(
      "INVALID_REQUEST",
      messageFromZod(envelope.error)
    );
  }

  let url: URL;
  try {
    url = new URL(envelope.data.url);
  } catch {
    throw new ApiInputError(
      "INVALID_REQUEST",
      "url must be a valid absolute URL."
    );
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new ApiInputError(
      "INVALID_REQUEST",
      "url must use http or https."
    );
  }

  if (envelope.data.outputSchema === undefined) {
    return {
      url: envelope.data.url,
      goal: envelope.data.goal
    };
  }

  const output = objectOutputSchema.safeParse(
    envelope.data.outputSchema
  );

  if (!output.success) {
    throw new ApiInputError(
      "UNSUPPORTED_OUTPUT_SCHEMA",
      messageFromZod(output.error)
    );
  }

  return {
    url: envelope.data.url,
    goal: envelope.data.goal,
    outputSchema: normalizeOutputSchema(output.data)
  };
}

function compileProperty(
  property: OutputPropertySchema
): z.ZodType {
  switch (property.type) {
    case "string":
      return property.const === undefined
        ? z.string()
        : z.literal(property.const);
    case "number":
      return property.const === undefined
        ? z.number()
        : z.literal(property.const);
    case "boolean":
      return property.const === undefined
        ? z.boolean()
        : z.literal(property.const);
  }
}

export function compileOutputSchema(
  schema: ObjectOutputSchema
): RuntimeSchema<Record<string, unknown>> {
  const required = new Set(schema.required ?? []);
  const shape: Record<string, z.ZodType> = {};

  for (const [name, property] of Object.entries(schema.properties)) {
    const compiled = compileProperty(property);
    shape[name] = required.has(name)
      ? compiled
      : compiled.optional();
  }

  return z.object(shape).strict();
}
