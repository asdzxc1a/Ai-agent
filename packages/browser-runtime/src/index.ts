export interface BrowserViewport {
  width: number;
  height: number;
}

export interface BrowserSessionOptions {
  headless?: boolean;
  viewport?: BrowserViewport;
}

export interface BrowserSession {
  readonly id: string;
  readonly cdpUrl: string;
  readonly viewerUrl?: string;

  close(): Promise<void>;
}

export interface BrowserRuntime {
  createSession(options?: BrowserSessionOptions): Promise<BrowserSession>;
}
