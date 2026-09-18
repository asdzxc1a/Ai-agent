import type {
  BrowserRuntime,
  BrowserSession,
  BrowserSessionOptions
} from "../src/index.js";

export class FakeBrowserSession implements BrowserSession {
  public readonly id: string;
  public readonly cdpUrl: string;
  public readonly viewerUrl?: string;
  public closeCalls = 0;

  public constructor({
    id = "browser-session-1",
    cdpUrl = "ws://browser.test/devtools/browser/1",
    viewerUrl
  }: {
    id?: string;
    cdpUrl?: string;
    viewerUrl?: string;
  } = {}) {
    this.id = id;
    this.cdpUrl = cdpUrl;

    if (viewerUrl !== undefined) {
      this.viewerUrl = viewerUrl;
    }
  }

  public async close(): Promise<void> {
    this.closeCalls += 1;
  }
}

export class FakeBrowserRuntime implements BrowserRuntime {
  public readonly sessions: FakeBrowserSession[] = [];
  public readonly createOptions: BrowserSessionOptions[] = [];

  public async createSession(
    options: BrowserSessionOptions = {}
  ): Promise<BrowserSession> {
    this.createOptions.push(options);

    const session = new FakeBrowserSession({
      id: `browser-session-${this.sessions.length + 1}`,
      cdpUrl: `ws://browser.test/devtools/browser/${this.sessions.length + 1}`
    });

    this.sessions.push(session);
    return session;
  }
}
