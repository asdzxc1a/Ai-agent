export interface BrowserViewport {
  width: number;
  height: number;
}

export interface BrowserSessionOptions {
  headless?: boolean;
  viewport?: BrowserViewport;
  networkProxyUrl?: string;
  signal?: AbortSignal;
}

export interface BrowserScreenshotOptions {
  fullPage?: boolean;
  signal?: AbortSignal;
}

export interface BrowserNetworkRequest {
  url: string;
  resourceType?: string;
  isNavigation?: boolean;
}

export interface BrowserDomainPolicy {
  allowedDomains?: readonly string[];
  blockedDomains?: readonly string[];
}

export interface BrowserNetworkPolicy {
  readonly domainPolicy?:
    BrowserDomainPolicy;

  assertAllowed(
    request: BrowserNetworkRequest
  ): Promise<void>;
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
  readonly isolationId?: string;
  readonly networkPolicy?: BrowserNetworkPolicy;

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
