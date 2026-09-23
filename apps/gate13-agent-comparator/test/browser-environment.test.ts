import {
  expect,
  test
} from "vitest";

import {
  comparatorChromeArguments,
  comparatorProxyBypassList
} from "../src/browser-environment.js";

test(
  "Chrome proxy bypass removes implicit loopback bypass and restores only the BrowserSkill daemon WebSocket",
  () => {
    expect(
      comparatorProxyBypassList(
        52800
      )
    ).toBe(
      "<-loopback>;ws://127.0.0.1:52800"
    );
  }
);

test(
  "dedicated comparator Chrome uses mock credential storage and never system Keychain",
  () => {
    const args =
      comparatorChromeArguments({
        profileDir:
          "/tmp/astra-comparator-profile",
        extensionDir:
          "/tmp/browser-skill-extension",
        proxyUrl:
          "http://127.0.0.1:61234",
        proxyBypassList:
          "<-loopback>;ws://127.0.0.1:52800"
      });

    expect(args).toContain(
      "--use-mock-keychain"
    );
    expect(args).toContain(
      "--password-store=basic"
    );
    expect(args).toContain(
      "--disable-sync"
    );
    expect(
      args.some(
        (arg) =>
          arg.startsWith(
            "--user-data-dir=/tmp/astra-comparator-profile"
          )
      )
    ).toBe(true);
    expect(
      args.some(
        (arg) =>
          arg.startsWith(
            "--proxy-server=http://127.0.0.1:"
          )
      )
    ).toBe(true);
  }
);
