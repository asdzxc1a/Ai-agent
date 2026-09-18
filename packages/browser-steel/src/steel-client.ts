export interface SteelSessionDetails {
  id: string;
  status: "idle" | "live" | "released" | "failed";
  websocketUrl: string;
  createdAt?: string;
  sessionViewerUrl?: string;
}

export interface SteelReleasedSession extends SteelSessionDetails {
  success: boolean;
}

export interface CreateSteelSessionOptions {
  headless?: boolean;
  skipFingerprintInjection?: boolean;
  dimensions?: {
    width: number;
    height: number;
  };
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, "");
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseSessionDetails(value: unknown): SteelSessionDetails {
  if (!isObject(value)) {
    throw new Error("Steel returned a non-object session response.");
  }

  const { id, status, websocketUrl, createdAt, sessionViewerUrl } = value;
  const validStatuses = new Set(["idle", "live", "released", "failed"]);

  if (
    typeof id !== "string" ||
    typeof status !== "string" ||
    !validStatuses.has(status) ||
    typeof websocketUrl !== "string"
  ) {
    throw new Error("Steel returned an invalid session response.");
  }

  return {
    id,
    status: status as SteelSessionDetails["status"],
    websocketUrl,
    ...(typeof createdAt === "string" ? { createdAt } : {}),
    ...(typeof sessionViewerUrl === "string" ? { sessionViewerUrl } : {})
  };
}

async function readError(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return "<unreadable response>";
  }
}

export class SteelClient {
  readonly #baseUrl: string;

  public constructor(baseUrl = "http://127.0.0.1:3000") {
    this.#baseUrl = normalizeBaseUrl(baseUrl);
  }

  public async isHealthy(): Promise<boolean> {
    const response = await fetch(`${this.#baseUrl}/v1/health`);
    if (!response.ok) {
      return false;
    }

    const payload: unknown = await response.json();
    return isObject(payload) && payload.status === "ok";
  }

  public async createSession(
    options: CreateSteelSessionOptions = {}
  ): Promise<SteelSessionDetails> {
    const response = await fetch(`${this.#baseUrl}/v1/sessions`, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(options)
    });

    if (!response.ok) {
      throw new Error(
        `Steel session creation failed with HTTP ${response.status}: ${await readError(response)}`
      );
    }

    const payload: unknown = await response.json();
    return parseSessionDetails(payload);
  }

  public async getSession(sessionId: string): Promise<SteelSessionDetails> {
    const response = await fetch(
      `${this.#baseUrl}/v1/sessions/${encodeURIComponent(sessionId)}`
    );

    if (!response.ok) {
      throw new Error(
        `Steel session lookup failed with HTTP ${response.status}: ${await readError(response)}`
      );
    }

    const payload: unknown = await response.json();
    return parseSessionDetails(payload);
  }

  public async releaseSession(sessionId: string): Promise<SteelReleasedSession> {
    const response = await fetch(
      `${this.#baseUrl}/v1/sessions/${encodeURIComponent(sessionId)}/release`,
      {
        method: "POST"
      }
    );

    if (!response.ok) {
      throw new Error(
        `Steel session release failed with HTTP ${response.status}: ${await readError(response)}`
      );
    }

    const payload: unknown = await response.json();
    const details = parseSessionDetails(payload);

    if (!isObject(payload) || payload.success !== true) {
      throw new Error("Steel returned an invalid release response.");
    }

    return {
      ...details,
      success: true
    };
  }
}
