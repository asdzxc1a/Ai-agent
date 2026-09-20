import {
  expect,
  test,
  vi
} from "vitest";
import type {
  Stagehand
} from "@browserbasehq/stagehand";
import type {
  BrowserSession
} from "../../browser-runtime/src/index.js";

import {
  StagehandRuntimeCore
} from "../src/runtime-core.js";

function browser():
  BrowserSession {
  return {
    id: "browser-1",
    cdpUrl:
      "ws://browser.test/1",
    async close() {}
  };
}

test(
  "pre-aborted agent startup does not create Stagehand",
  async () => {
    const createStagehand =
      vi.fn(() => {
        throw new Error(
          "must not create"
        );
      });
    const runtime =
      new StagehandRuntimeCore(
        createStagehand
      );
    const controller =
      new AbortController();
    controller.abort();

    await expect(
      runtime.openSession({
        browser: browser(),
        signal:
          controller.signal
      })
    ).rejects.toMatchObject({
      name: "AbortError"
    });

    expect(
      createStagehand
    ).not.toHaveBeenCalled();
  }
);

test(
  "failed Stagehand initialization closes the partial provider object",
  async () => {
    const initError =
      new Error("init failed");
    const stagehand = {
      init: vi
        .fn()
        .mockRejectedValue(
          initError
        ),
      close: vi
        .fn()
        .mockResolvedValue(
          undefined
        )
    } as unknown as Stagehand;

    const runtime =
      new StagehandRuntimeCore(
        () => stagehand
      );

    await expect(
      runtime.openSession({
        browser: browser()
      })
    ).rejects.toBe(
      initError
    );

    expect(
      stagehand.close
    ).toHaveBeenCalledTimes(1);
  }
);

test(
  "abort during Stagehand initialization closes the partial provider and rejects",
  async () => {
    const stagehand = {
      init: vi.fn(
        () =>
          new Promise<void>(
            () => undefined
          )
      ),
      close: vi
        .fn()
        .mockResolvedValue(
          undefined
        )
    } as unknown as Stagehand;
    const runtime =
      new StagehandRuntimeCore(
        () => stagehand
      );
    const controller =
      new AbortController();

    const opening =
      runtime.openSession({
        browser: browser(),
        signal:
          controller.signal
      });

    expect(
      stagehand.init
    ).toHaveBeenCalledTimes(1);

    controller.abort();

    await expect(
      opening
    ).rejects.toMatchObject({
      name: "AbortError"
    });

    expect(
      stagehand.close
    ).toHaveBeenCalledTimes(1);
  }
);
