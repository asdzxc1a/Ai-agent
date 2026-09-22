import {
  describe,
  expect,
  it
} from "vitest";

import {
  DefaultSandboxNetworkPolicy,
  SandboxNetworkPolicyError,
  isBlockedNetworkAddress,
  type SandboxDnsResolver
} from "../src/index.js";

class SequenceResolver
  implements SandboxDnsResolver {
  readonly #answers:
    readonly (readonly string[])[];
  #index = 0;

  public constructor(
    answers:
      readonly (readonly string[])[]
  ) {
    this.#answers = answers;
  }

  public async resolve():
    Promise<readonly string[]> {
    const value =
      this.#answers[
        Math.min(
          this.#index,
          this.#answers.length - 1
        )
      ] ?? [];

    this.#index += 1;
    return value;
  }
}

function expectCode(
  error: unknown,
  code:
    SandboxNetworkPolicyError[
      "code"
    ]
): void {
  expect(
    error
  ).toBeInstanceOf(
    SandboxNetworkPolicyError
  );

  expect(
    (
      error as
        SandboxNetworkPolicyError
    ).code
  ).toBe(code);
}

describe(
  "DefaultSandboxNetworkPolicy",
  () => {
    it("defaults to deny-all until egress hosts are explicitly declared", async () => {
      const policy =
        new DefaultSandboxNetworkPolicy({
          resolver: {
            async resolve() {
              return [
                "93.184.216.34"
              ];
            }
          }
        });

      expect(
        policy.domainPolicy
      ).toEqual({
        allowedDomains: [
          "astra-deny-all.invalid"
        ]
      });

      await expect(
        policy.assertAllowed({
          url:
            "https://example.com/"
        })
      ).rejects.toSatisfy(
        (error: unknown) => {
          expectCode(
            error,
            "BLOCKED_HOSTNAME"
          );
          return true;
        }
      );
    });

    it("blocks local, private, link-local, metadata, reserved, and non-http targets", async () => {
      const policy =
        new DefaultSandboxNetworkPolicy({
          allowedHostnames: [
            "example.com"
          ],
          resolver: {
            async resolve() {
              return [
                "203.0.113.10"
              ];
            }
          }
        });

      for (const url of [
        "file:///etc/passwd",
        "http://localhost/",
        "http://127.0.0.1/",
        "http://10.0.0.1/",
        "http://172.16.0.1/",
        "http://192.168.1.1/",
        "http://169.254.169.254/latest/meta-data/",
        "http://[::1]/",
        "http://[fe80::1]/",
        "http://metadata.google.internal/"
      ]) {
        await expect(
          policy.assertAllowed({
            url
          })
        ).rejects.toBeInstanceOf(
          SandboxNetworkPolicyError
        );
      }
    });

    it("blocks private DNS answers and mixed public/private answers", async () => {
      const privatePolicy =
        new DefaultSandboxNetworkPolicy({
          allowedHostnames: [
            "example.com"
          ],
          resolver: {
            async resolve() {
              return [
                "10.10.0.5"
              ];
            }
          }
        });

      await expect(
        privatePolicy.assertAllowed({
          url:
            "https://example.com/"
        })
      ).rejects.toSatisfy(
        (error: unknown) => {
          expectCode(
            error,
            "BLOCKED_ADDRESS"
          );
          return true;
        }
      );

      const mixedPolicy =
        new DefaultSandboxNetworkPolicy({
          allowedHostnames: [
            "example.com"
          ],
          resolver: {
            async resolve() {
              return [
                "93.184.216.34",
                "192.168.0.10"
              ];
            }
          }
        });

      await expect(
        mixedPolicy.assertAllowed({
          url:
            "https://example.com/"
        })
      ).rejects.toSatisfy(
        (error: unknown) => {
          expectCode(
            error,
            "BLOCKED_ADDRESS"
          );
          return true;
        }
      );
    });

    it("returns exact validated public addresses for connection binding", async () => {
      const policy =
        new DefaultSandboxNetworkPolicy({
          allowedHostnames: [
            "example.com"
          ],
          resolver: {
            async resolve() {
              return [
                "93.184.216.34",
                "2606:2800:220:1:248:1893:25c8:1946"
              ];
            }
          }
        });

      await expect(
        policy.resolveAllowedTarget({
          url:
            "https://example.com/path"
        })
      ).resolves.toMatchObject({
        protocol:
          "https:",
        hostname:
          "example.com",
        port: 443,
        trusted: false,
        addresses: [
          "93.184.216.34",
          "2606:2800:220:1:248:1893:25c8:1946"
        ]
      });
    });

    it("re-resolves every request so a DNS rebind is blocked", async () => {
      const policy =
        new DefaultSandboxNetworkPolicy({
          allowedHostnames: [
            "example.com"
          ],
          resolver:
            new SequenceResolver([
              [
                "93.184.216.34"
              ],
              [
                "10.0.0.8"
              ]
            ])
        });

      await expect(
        policy.assertAllowed({
          url:
            "https://example.com/"
        })
      ).resolves.toBeUndefined();

      await expect(
        policy.assertAllowed({
          url:
            "https://example.com/redirected"
        })
      ).rejects.toSatisfy(
        (error: unknown) => {
          expectCode(
            error,
            "BLOCKED_ADDRESS"
          );
          return true;
        }
      );
    });

    it("restricts public ports by default and allows explicit trusted fixture hosts", async () => {
      const defaultPolicy =
        new DefaultSandboxNetworkPolicy({
          allowedHostnames: [
            "example.com"
          ],
          resolver: {
            async resolve() {
              return [
                "93.184.216.34"
              ];
            }
          }
        });

      await expect(
        defaultPolicy.assertAllowed({
          url:
            "https://example.com:8443/"
        })
      ).rejects.toSatisfy(
        (error: unknown) => {
          expectCode(
            error,
            "BLOCKED_PORT"
          );
          return true;
        }
      );

      const fixturePolicy =
        new DefaultSandboxNetworkPolicy({
          trustedHostnames: [
            "host.docker.internal"
          ],
          resolver: {
            async resolve() {
              return [
                "192.168.65.2"
              ];
            }
          }
        });

      await expect(
        fixturePolicy.assertAllowed({
          url:
            "http://host.docker.internal:4173/"
        })
      ).resolves.toBeUndefined();
    });

    it("allows approved domains and subdomains without allowing lookalikes", async () => {
      const policy =
        new DefaultSandboxNetworkPolicy({
          allowedDomains: [
            "example.com"
          ],
          resolver: {
            async resolve() {
              return [
                "93.184.216.34"
              ];
            }
          }
        });

      expect(
        policy.domainPolicy
      ).toEqual({
        allowedDomains: [
          "example.com",
          "*.example.com"
        ]
      });

      await expect(
        policy.assertAllowed({
          url:
            "https://example.com/"
        })
      ).resolves.toBeUndefined();

      await expect(
        policy.assertAllowed({
          url:
            "https://www.example.com/"
        })
      ).resolves.toBeUndefined();

      await expect(
        policy.assertAllowed({
          url:
            "https://deep.docs.example.com/"
        })
      ).resolves.toBeUndefined();

      await expect(
        policy.assertAllowed({
          url:
            "https://notexample.com/"
        })
      ).rejects.toSatisfy(
        (error: unknown) => {
          expectCode(
            error,
            "BLOCKED_HOSTNAME"
          );
          return true;
        }
      );
    });

    it("allows ordinary public https destinations", async () => {
      const policy =
        new DefaultSandboxNetworkPolicy({
          allowedHostnames: [
            "example.com"
          ],
          resolver: {
            async resolve() {
              return [
                "93.184.216.34",
                "2606:2800:220:1:248:1893:25c8:1946"
              ];
            }
          }
        });

      await expect(
        policy.assertAllowed({
          url:
            "https://example.com/"
        })
      ).resolves.toBeUndefined();
    });
  }
);

describe(
  "isBlockedNetworkAddress",
  () => {
    it("defaults to non-public addresses being blocked", () => {
      expect(
        isBlockedNetworkAddress(
          "127.0.0.1"
        )
      ).toBe(true);
      expect(
        isBlockedNetworkAddress(
          "192.168.1.5"
        )
      ).toBe(true);
      expect(
        isBlockedNetworkAddress(
          "::1"
        )
      ).toBe(true);
      expect(
        isBlockedNetworkAddress(
          "93.184.216.34"
        )
      ).toBe(false);
      expect(
        isBlockedNetworkAddress(
          "2606:2800:220:1:248:1893:25c8:1946"
        )
      ).toBe(false);
    });
  }
);
