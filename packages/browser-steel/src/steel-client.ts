export interface SteelSession {
  id: string;
  createdAt: string;
  status: "idle" | "live" | "released" | "failed";
  websocketUrl: string;
  debugUrl: string;
  debuggerUrl: string;
  sessionViewerUrl: string;
}

export interface CreateSteelSessionOptions {
  headless?: boolean;
  timezone?: string;
  skipFingerprintInjection?: boolean;
  deviceConfig?: {
    device: "desktop" | "mobile";
  };
}

interface SteelSessionList {
  sessions: SteelSession[];
}

interface SteelLiveDetails {
  browserState: {
    pageCount: number;
  };
}

export interface SteelClientOptions {
  baseUrl?: string;
  readyTimeoutMs?: number;
  pollIntervalMs?: number;
}

export class SteelClient {
  readonly baseUrl: string;
  private readonly readyTimeoutMs: number;
  private readonly pollIntervalMs: number;

  constructor(options: SteelClientOptions = {}) {
    this.baseUrl = (options.baseUrl ?? "http://127.0.0.1:3000").replace(/\/$/, "");
    this.readyTimeoutMs = options.readyTimeoutMs ?? 90_000;
    this.pollIntervalMs = options.pollIntervalMs ?? 250;
  }

  async waitUntilReady(): Promise<void> {
    const deadline = Date.now() + this.readyTimeoutMs;
    let lastError: unknown;

    while (Date.now() < deadline) {
      try {
        const health = await fetch(this.url("/v1/health"));
        if (!health.ok) {
          lastError = new Error(`Steel health returned HTTP ${health.status}`);
          await delay(this.pollIntervalMs);
          continue;
        }

        const healthBody = (await health.json()) as { status?: string };
        if (healthBody.status !== "ok") {
          lastError = new Error(`Steel health returned status ${String(healthBody.status)}`);
          await delay(this.pollIntervalMs);
          continue;
        }

        const sessions = await this.listSessions();
        const activeSession = sessions[0];
        if (!activeSession) {
          lastError = new Error("Steel returned no active session");
          await delay(this.pollIntervalMs);
          continue;
        }

        const liveDetails = await this.request<SteelLiveDetails>(
          `/v1/sessions/${encodeURIComponent(activeSession.id)}/live-details`
        );

        if (liveDetails.browserState.pageCount > 0) {
          return;
        }

        lastError = new Error("Steel browser has no ready pages yet");
      } catch (error) {
        lastError = error;
      }

      await delay(this.pollIntervalMs);
    }

    const suffix = lastError instanceof Error ? `: ${lastError.message}` : "";
    throw new Error(`Steel browser did not become ready within ${this.readyTimeoutMs}ms${suffix}`);
  }

  async createSession(options: CreateSteelSessionOptions = {}): Promise<SteelSession> {
    return this.request<SteelSession>("/v1/sessions", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(options)
    });
  }

  async listSessions(): Promise<SteelSession[]> {
    const result = await this.request<SteelSessionList>("/v1/sessions");
    return result.sessions;
  }

  async releaseSession(sessionId: string): Promise<void> {
    await this.request<unknown>(`/v1/sessions/${encodeURIComponent(sessionId)}/release`, {
      method: "POST"
    });
  }

  async releaseAllSessions(): Promise<void> {
    await this.request<unknown>("/v1/sessions/release", {
      method: "POST"
    });
  }

  private url(path: string): string {
    return `${this.baseUrl}${path}`;
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(this.url(path), init);

    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `Steel request ${init?.method ?? "GET"} ${path} failed with HTTP ${response.status}: ${body}`
      );
    }

    return (await response.json()) as T;
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
