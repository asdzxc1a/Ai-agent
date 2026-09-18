const REDACTED = "[REDACTED]";

const SENSITIVE_KEY =
  /(password|passphrase|secret|token|access[_-]?token|api[_-]?key|authorization|bearer|cookie|set[_-]?cookie|private[_-]?key)/i;

function redactUrl(value: string): string {
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    return value;
  }

  if (
    url.protocol !== "http:" &&
    url.protocol !== "https:"
  ) {
    return value;
  }

  for (const key of [...url.searchParams.keys()]) {
    if (SENSITIVE_KEY.test(key)) {
      url.searchParams.set(key, REDACTED);
    }
  }

  return url.toString();
}

function redactString(value: string): string {
  let redacted = redactUrl(value);

  redacted = redacted.replace(
    /\bBearer\s+[A-Za-z0-9._~+\/=:-]+/gi,
    "Bearer [REDACTED]"
  );

  redacted = redacted.replace(
    /((?:password|passphrase|secret|token|access[_-]?token|api[_-]?key|authorization|cookie|set[_-]?cookie|private[_-]?key)\s*[:=]\s*)([^\s&;,]+)/gi,
    "$1[REDACTED]"
  );

  return redacted;
}

export function redactArtifactValue(
  value: unknown
): unknown {
  if (typeof value === "string") {
    return redactString(value);
  }

  if (
    value === null ||
    typeof value !== "object"
  ) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(redactArtifactValue);
  }

  if (value instanceof Uint8Array) {
    return "[BINARY]";
  }

  const source = value as Record<string, unknown>;
  const result: Record<string, unknown> = {};

  for (const [key, nested] of Object.entries(source)) {
    result[key] = SENSITIVE_KEY.test(key)
      ? REDACTED
      : redactArtifactValue(nested);
  }

  return result;
}

export function redactArtifactMetadata(
  metadata: Record<string, unknown> | undefined
): Record<string, unknown> | undefined {
  if (metadata === undefined) {
    return undefined;
  }

  return redactArtifactValue(
    metadata
  ) as Record<string, unknown>;
}

export function encodeRedactedJson(
  value: unknown
): Uint8Array {
  return new TextEncoder().encode(
    JSON.stringify(
      redactArtifactValue(value),
      null,
      2
    )
  );
}
