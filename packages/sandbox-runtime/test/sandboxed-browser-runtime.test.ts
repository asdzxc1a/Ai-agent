import {
  expect,
  test
} from "vitest";

import type {
  BrowserNetworkPolicy,
  BrowserRuntime,
  BrowserSession,
  BrowserSessionOptions
} from "@astra/browser-runtime";

import {
  LocalSandboxRuntime,
  SandboxedBrowserRuntime,
  type SandboxRuntime,
  type SandboxSession,
  type SandboxStatus
} from "../src/index.js";

class FakeBrowserSession
  implements BrowserSession {
  public readonly id: string;
  public readonly cdpUrl:
    string;
  public closeCalls = 0;
  public failClose = false;

  public constructor(
    id: string
  ) {
    this.id = id;
    this.cdpUrl =
      "ws://fixture/" + id;
  }

  public async close():
    Promise<void> {
    this.closeCalls += 1;

    if (this.failClose) {
      throw new Error(
        "browser close failed"
      );
    }
  }
}

class FakeBrowserRuntime
  implements BrowserRuntime {
  public readonly sessions:
    FakeBrowserSession[] = [];
  public readonly proxyUrls:
    Array<string | undefined> =
      [];
  public failCreate = false;

  public async createSession(
    options:
      BrowserSessionOptions = {}
  ): Promise<BrowserSession> {
    this.proxyUrls.push(
      options.networkProxyUrl
    );
    if (this.failCreate) {
      throw new Error(
        "browser create failed"
      );
    }

    const session =
      new FakeBrowserSession(
        "browser-" +
          String(
            this.sessions.length +
              1
          )
      );
    this.sessions.push(session);
    return session;
  }
}

class RecordingSandboxSession
  implements SandboxSession {
  public readonly id: string;
  public readonly networkPolicy:
    BrowserNetworkPolicy = {
      async assertAllowed() {}
    };
  public closeCalls = 0;
  #status: SandboxStatus =
    "ACTIVE";

  public constructor(
    id: string
  ) {
    this.id = id;
  }

  public get status():
    SandboxStatus {
    return this.#status;
  }

  public async close():
    Promise<void> {
    this.closeCalls += 1;
    this.#status =
      "CLOSED";
  }
}

class RecordingSandboxRuntime
  implements SandboxRuntime {
  public readonly sessions:
    RecordingSandboxSession[] =
      [];

  public async createSession():
    Promise<SandboxSession> {
    const session =
      new RecordingSandboxSession(
        "sandbox-" +
          String(
            this.sessions.length +
              1
          )
      );
    this.sessions.push(session);
    return session;
  }
}

test("sandboxed browser sessions expose owned isolation and policy identity", async () => {
  const sandboxRuntime =
    new RecordingSandboxRuntime();
  const browserRuntime =
    new FakeBrowserRuntime();
  const runtime =
    new SandboxedBrowserRuntime({
      sandboxRuntime,
      browserRuntime
    });

  const first =
    await runtime.createSession();
  const second =
    await runtime.createSession();

  expect(
    first.isolationId
  ).toBe("sandbox-1");
  expect(
    second.isolationId
  ).toBe("sandbox-2");
  expect(
    first.networkPolicy
  ).not.toBe(
    second.networkPolicy
  );
  expect(first.id).not.toBe(
    second.id
  );

  await first.close();

  expect(
    sandboxRuntime
      .sessions[0]?.status
  ).toBe("CLOSED");
  expect(
    sandboxRuntime
      .sessions[1]?.status
  ).toBe("ACTIVE");

  await second.close();
});

test("sandbox-owned network proxy overrides the browser route", async () => {
  const sandboxRuntime:
    SandboxRuntime = {
      async createSession() {
        return {
          id:
            "sandbox-proxy",
          status:
            "ACTIVE",
          networkPolicy: {
            async assertAllowed() {}
          },
          networkProxyUrl:
            "http://proxy.test:8080",
          async close() {}
        };
      }
    };
  const browserRuntime =
    new FakeBrowserRuntime();
  const runtime =
    new SandboxedBrowserRuntime({
      sandboxRuntime,
      browserRuntime
    });

  await runtime.createSession({
    networkProxyUrl:
      "http://caller-bypass.test:9999"
  });

  expect(
    browserRuntime.proxyUrls
  ).toEqual([
    "http://proxy.test:8080"
  ]);
});

test("sandbox cleanup still runs when browser cleanup fails", async () => {
  const sandboxRuntime =
    new RecordingSandboxRuntime();
  const browserRuntime =
    new FakeBrowserRuntime();
  const runtime =
    new SandboxedBrowserRuntime({
      sandboxRuntime,
      browserRuntime
    });

  const session =
    await runtime.createSession();
  const browser =
    browserRuntime.sessions[0];

  if (browser === undefined) {
    throw new Error(
      "Expected browser session."
    );
  }

  browser.failClose = true;

  await expect(
    session.close()
  ).rejects.toThrow(
    "browser close failed"
  );

  expect(
    sandboxRuntime
      .sessions[0]?.status
  ).toBe("CLOSED");
});

test("sandbox closes when underlying browser creation fails", async () => {
  const sandboxRuntime =
    new RecordingSandboxRuntime();
  const browserRuntime =
    new FakeBrowserRuntime();
  browserRuntime.failCreate =
    true;

  const runtime =
    new SandboxedBrowserRuntime({
      sandboxRuntime,
      browserRuntime
    });

  await expect(
    runtime.createSession()
  ).rejects.toThrow(
    "browser create failed"
  );

  expect(
    sandboxRuntime
      .sessions[0]?.status
  ).toBe("CLOSED");
});

test("owned sandbox sessions expose no filesystem process environment or raw port capabilities", async () => {
  const runtime =
    new LocalSandboxRuntime({
      trustedHostnames: [
        "fixture.test"
      ]
    });

  const session =
    await runtime.createSession();

  for (const capability of [
    "readFile",
    "writeFile",
    "filesystem",
    "exec",
    "spawn",
    "process",
    "environment",
    "env",
    "listen",
    "connect",
    "openPort",
    "ports"
  ]) {
    expect(
      capability in
        (session as unknown as
          Record<string, unknown>)
    ).toBe(false);
  }

  await session.close();
});

test("local sandbox sessions have unique identities and independent lifecycle", async () => {
  const runtime =
    new LocalSandboxRuntime({
      allowedHostnames: [
        "fixture.test"
      ]
    });

  const first =
    await runtime.createSession();
  const second =
    await runtime.createSession();

  expect(first.id).not.toBe(
    second.id
  );
  expect(
    first.networkPolicy
  ).not.toBe(
    second.networkPolicy
  );
  expect(first.status).toBe(
    "ACTIVE"
  );
  expect(second.status).toBe(
    "ACTIVE"
  );

  await first.close();

  expect(first.status).toBe(
    "CLOSED"
  );
  expect(second.status).toBe(
    "ACTIVE"
  );
});
