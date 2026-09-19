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
