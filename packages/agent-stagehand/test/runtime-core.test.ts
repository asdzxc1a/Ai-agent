import {
  expect,
  test,
  vi
} from "vitest";

import type {
  BrowserSession
} from "@astra/browser-runtime";
import type {
  Stagehand,
  Stagehand as StagehandType
} from "@browserbasehq/stagehand";

import {
  StagehandRuntimeCore
} from "../src/runtime-core.js";

function isolatedBrowser():
  BrowserSession {
  return {
    id: "isolated-browser",
    cdpUrl:
      "ws://fixture/browser",
    isolationId:
      "sandbox-1",
    networkPolicy: {
      domainPolicy: {
        allowedDomains: [
          "example.com"
        ]
      },
      async assertAllowed() {}
    },
    async close() {}
  };
}

test(
  "isolated cleanup clears visited-origin storage through a page target CDP session",
  async () => {
    const rootSend =
      vi.fn(
        async () => {
          throw new Error(
            "browser-root Storage command unsupported"
          );
        }
      );
    const pageSend =
      vi.fn(
        async () => undefined
      );
    const page = {
      url() {
        return "https://example.com/path";
      },
      async goto() {
        return null;
      },
      sendCDP:
        pageSend
    };
    const clearCookies =
      vi.fn(
        async () => undefined
      );
    const close =
      vi.fn(
        async () => undefined
      );
    const stagehand = {
      init: vi.fn(
        async () => undefined
      ),
      close,
      context: {
        conn: {
          send: rootSend
        },
        pages() {
          return [page];
        },
        activePage() {
          return page;
        },
        clearCookies,
        setDomainPolicy:
          vi.fn(
            async () =>
              undefined
          ),
        handleDomainPolicyRequestPaused:
          vi.fn(
            async () =>
              undefined
          )
      },
      observe:
        vi.fn(
          async () => []
        ),
      act:
        vi.fn(),
      extract:
        vi.fn()
    } as unknown as Stagehand;

    const runtime =
      new StagehandRuntimeCore(
        () =>
          stagehand as
            StagehandType
      );
    const session =
      await runtime.openSession({
        browser:
          isolatedBrowser()
      });

    await session.navigate(
      "https://example.com/path"
    );
    await expect(
      session.close()
    ).resolves.toBeUndefined();

    expect(
      clearCookies
    ).toHaveBeenCalledTimes(1);
    expect(
      pageSend
    ).toHaveBeenCalledWith(
      "Storage.clearDataForOrigin",
      {
        origin:
          "https://example.com",
        storageTypes: "all"
      }
    );
    expect(
      rootSend
    ).not.toHaveBeenCalled();
    expect(
      close
    ).toHaveBeenCalledTimes(1);
  }
);

test(
  "full network policy owns the Stagehand Fetch decision for allowed and blocked requests",
  async () => {
    const continueOrFail =
      vi.fn(
        async () => undefined
      );
    const originalHandler =
      vi.fn(
        async (
          session: unknown,
          event: unknown
        ) => {
          void session;
          void event;
        }
      );
    const setDomainPolicy =
      vi.fn(
        async () => undefined
      );
    const context = {
      setDomainPolicy,
      handleDomainPolicyRequestPaused:
        originalHandler
    };
    const close =
      vi.fn(
        async () => undefined
      );
    const stagehand = {
      init:
        vi.fn(
          async () => undefined
        ),
      close,
      context,
      observe:
        vi.fn(
          async () => []
        ),
      act: vi.fn(),
      extract: vi.fn()
    } as unknown as Stagehand;
    const assertAllowed =
      vi.fn(
        async (
          request: {
            url: string;
          }
        ) => {
          if (
            request.url.includes(
              ":8443/"
            )
          ) {
            throw new Error(
              "blocked port"
            );
          }
        }
      );
    const browser:
      BrowserSession = {
        id: "policy-browser",
        cdpUrl:
          "ws://fixture/policy",
        networkPolicy: {
          domainPolicy: {
            allowedDomains: [
              "example.com"
            ]
          },
          assertAllowed
        },
        async close() {}
      };

    const runtime =
      new StagehandRuntimeCore(
        () =>
          stagehand as
            StagehandType
      );
    const session =
      await runtime.openSession({
        browser
      });

    expect(
      setDomainPolicy
    ).toHaveBeenCalledWith({
      allowedDomains: [
        "example.com"
      ]
    });
    expect(
      context
        .handleDomainPolicyRequestPaused
    ).not.toBe(
      originalHandler
    );

    await context
      .handleDomainPolicyRequestPaused(
        {
          send:
            continueOrFail
        },
        {
          requestId:
            "request.allowed",
          request: {
            url:
              "https://example.com/path"
          },
          resourceType:
            "Document"
        }
      );

    expect(
      continueOrFail
    ).toHaveBeenCalledWith(
      "Fetch.continueRequest",
      {
        requestId:
          "request.allowed"
      }
    );

    continueOrFail.mockClear();

    await context
      .handleDomainPolicyRequestPaused(
        {
          send:
            continueOrFail
        },
        {
          requestId:
            "request.blocked",
          request: {
            url:
              "https://example.com:8443/private"
          },
          resourceType:
            "Document"
        }
      );

    expect(
      continueOrFail
    ).toHaveBeenCalledWith(
      "Fetch.failRequest",
      {
        requestId:
          "request.blocked",
        errorReason:
          "BlockedByClient"
      }
    );
    expect(
      originalHandler
    ).not.toHaveBeenCalled();
    expect(
      assertAllowed
    ).toHaveBeenCalledTimes(2);

    await session.close();
    expect(close)
      .toHaveBeenCalledTimes(1);
  }
);

test(
  "page evidence capture returns the active final URL and visible text",
  async () => {
    const page = {
      url() {
        return "https://example.com/final";
      },
      async title() {
        return "Example final page";
      },
      async evaluate() {
        return "Visible public evidence";
      }
    };
    const stagehand = {
      init:
        vi.fn(
          async () => undefined
        ),
      close:
        vi.fn(
          async () => undefined
        ),
      context: {
        pages() {
          return [page];
        },
        activePage() {
          return page;
        }
      },
      observe:
        vi.fn(
          async () => []
        ),
      act: vi.fn(),
      extract: vi.fn()
    } as unknown as Stagehand;
    const runtime =
      new StagehandRuntimeCore(
        () =>
          stagehand as
            StagehandType
      );
    const browser:
      BrowserSession = {
        id:
          "page-evidence-browser",
        cdpUrl:
          "ws://fixture/page-evidence",
        async close() {}
      };
    const session =
      await runtime.openSession({
        browser
      });

    await expect(
      session
        .capturePageEvidence?.()
    ).resolves.toEqual({
      url:
        "https://example.com/final",
      title:
        "Example final page",
      text:
        "Visible public evidence"
    });

    await session.close();
  }
);

test(
  "network policy installation fails closed when the pinned Stagehand request hook is unavailable",
  async () => {
    const close =
      vi.fn(
        async () => undefined
      );
    const stagehand = {
      init:
        vi.fn(
          async () => undefined
        ),
      close,
      context: {
        setDomainPolicy:
          vi.fn(
            async () => undefined
          )
      }
    } as unknown as Stagehand;
    const runtime =
      new StagehandRuntimeCore(
        () =>
          stagehand as
            StagehandType
      );

    await expect(
      runtime.openSession({
        browser:
          isolatedBrowser()
      })
    ).rejects.toThrow(
      "Pinned Stagehand request-policy interception hook is unavailable."
    );
    expect(close)
      .toHaveBeenCalledTimes(1);
  }
);



test(
  "maps Stagehand metrics into owned model-usage evidence",
  async () => {
    const page = {
      url() {
        return "https://example.com/";
      }
    };
    const stagehand = {
      init:
        vi.fn(
          async () => undefined
        ),
      close:
        vi.fn(
          async () => undefined
        ),
      metrics:
        Promise.resolve({
          actPromptTokens: 1,
          actCompletionTokens: 2,
          actReasoningTokens: 3,
          actCachedInputTokens: 4,
          actInferenceTimeMs: 5,
          extractPromptTokens: 10,
          extractCompletionTokens: 20,
          extractReasoningTokens: 30,
          extractCachedInputTokens: 40,
          extractInferenceTimeMs: 50,
          observePromptTokens: 100,
          observeCompletionTokens: 200,
          observeReasoningTokens: 300,
          observeCachedInputTokens: 400,
          observeInferenceTimeMs: 500,
          agentPromptTokens: 1000,
          agentCompletionTokens: 2000,
          agentReasoningTokens: 3000,
          agentCachedInputTokens: 4000,
          agentInferenceTimeMs: 5000,
          totalPromptTokens: 1111,
          totalCompletionTokens: 2222,
          totalReasoningTokens: 3333,
          totalCachedInputTokens: 4444,
          totalInferenceTimeMs: 5555
        }),
      context: {
        pages() {
          return [page];
        },
        activePage() {
          return page;
        }
      },
      observe:
        vi.fn(
          async () => []
        ),
      act: vi.fn(),
      extract: vi.fn()
    } as unknown as Stagehand;
    const runtime =
      new StagehandRuntimeCore(
        () =>
          stagehand as
            StagehandType
      );
    const browser:
      BrowserSession = {
        id:
          "usage-browser",
        cdpUrl:
          "ws://fixture/usage",
        async close() {}
      };
    const session =
      await runtime.openSession({
        browser
      });

    await expect(
      session.getModelUsage?.()
    ).resolves.toEqual({
      promptTokens:
        1111,
      completionTokens:
        2222,
      reasoningTokens:
        3333,
      cachedInputTokens:
        4444,
      inferenceTimeMs:
        5555
    });

    await session.close();
  }
);


test(
  "rejects invalid Stagehand model-usage metrics instead of persisting false measurement evidence",
  async () => {
    const page = {
      url() {
        return "https://example.com/";
      }
    };
    const stagehand = {
      init:
        vi.fn(
          async () => undefined
        ),
      close:
        vi.fn(
          async () => undefined
        ),
      metrics:
        Promise.resolve({
          totalPromptTokens: -1,
          totalCompletionTokens: 0,
          totalReasoningTokens: 0,
          totalCachedInputTokens: 0,
          totalInferenceTimeMs: 0
        }),
      context: {
        pages() {
          return [page];
        },
        activePage() {
          return page;
        }
      }
    } as unknown as Stagehand;
    const runtime =
      new StagehandRuntimeCore(
        () =>
          stagehand as
            StagehandType
      );
    const browser:
      BrowserSession = {
        id:
          "invalid-usage-browser",
        cdpUrl:
          "ws://fixture/invalid-usage",
        async close() {}
      };
    const session =
      await runtime.openSession({
        browser
      });

    await expect(
      session.getModelUsage?.()
    ).rejects.toThrow(
      "totalPromptTokens"
    );

    await session.close();
  }
);
