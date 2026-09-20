export interface BrowserViewport {
  width: number;
  height: number;
}

export interface BrowserSessionOptions {
  headless?: boolean;
  viewport?: BrowserViewport;
  signal?: AbortSignal;
}

export interface BrowserScreenshotOptions {
  fullPage?: boolean;
}

export type BrowserDiagnosticKind =
  | "console"
  | "page-error"
  | "browser-error"
  | "request-failed"
  | "error";

export interface BrowserDiagnostic {
  kind: BrowserDiagnosticKind;
  message: string;
  level?: string;
  timestamp?: string;
  location?: string;
  url?: string;
}

export interface BrowserSession {
  readonly id: string;
  readonly cdpUrl: string;
  readonly viewerUrl?: string;

  captureScreenshot?(
    options?: BrowserScreenshotOptions
  ): Promise<Uint8Array>;

  getDiagnostics?(): Promise<BrowserDiagnostic[]>;

  close(): Promise<void>;
}

export interface BrowserRuntime {
  createSession(
    options?: BrowserSessionOptions
  ): Promise<BrowserSession>;
}
