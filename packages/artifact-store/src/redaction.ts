const REDACTED = "[REDACTED]";

const SENSITIVE_KEY =
  /(password|passphrase|secret|token|access[_-]?token|api[_-]?key|authorization|bearer|cookie|set[_-]?cookie|private[_-]?key)/i;

const SENSITIVE_URL_KEY =
  /(password|passphrase|secret|token|access[_-]?token|api[_-]?key|authorization|bearer|cookie|set[_-]?cookie|private[_-]?key|credential|signature|sig)/i;

const SAFE_NUMERIC_USAGE_KEYS =
  new Set([
    "promptTokens",
    "completionTokens",
    "reasoningTokens",
    "cachedInputTokens"
  ]);

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

  if (url.password.length > 0) {
    url.password = REDACTED;
  }

  for (const key of [...url.searchParams.keys()]) {
    if (SENSITIVE_URL_KEY.test(key)) {
      url.searchParams.set(key, REDACTED);
    }
  }

  return url.toString();
}

function redactString(value: string): string {
  let redacted = redactUrl(value);

  redacted = redacted.replace(
    /-----BEGIN [^-\r\n]*PRIVATE KEY-----[\s\S]*?-----END [^-\r\n]*PRIVATE KEY-----/gi,
    "[REDACTED PRIVATE KEY]"
  );

  redacted = redacted.replace(
    /((?:authorization|cookie|set-cookie)\s*[:=]\s*)[^\r\n]+/gi,
    "$1[REDACTED]"
  );

  redacted = redacted.replace(
    /\bBearer\s+[^\s,;]+/gi,
    "Bearer [REDACTED]"
  );

  redacted = redacted.replace(
    /((?:password|passphrase|secret|token|access[_-]?token|api[_-]?key|private[_-]?key)\s*[:=]\s*)(?:"[^"]*"|'[^']*'|[^\s&;,]+)/gi,
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
    const safeNumericUsage =
      SAFE_NUMERIC_USAGE_KEYS.has(
        key
      ) &&
      typeof nested ===
        "number" &&
      Number.isFinite(
        nested
      ) &&
      nested >= 0;

    result[key] =
      safeNumericUsage
        ? nested
        : SENSITIVE_KEY.test(
            key
          )
          ? REDACTED
          : redactArtifactValue(
              nested
            );
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
