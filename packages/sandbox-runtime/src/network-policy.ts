import {
  isIP
} from "node:net";
import {
  promises as dns
} from "node:dns";

import type {
  BrowserNetworkPolicy,
  BrowserNetworkRequest
} from "@astra/browser-runtime";

export type SandboxNetworkPolicyErrorCode =
  | "DISALLOWED_SCHEME"
  | "URL_CREDENTIALS"
  | "BLOCKED_HOSTNAME"
  | "BLOCKED_ADDRESS"
  | "BLOCKED_PORT"
  | "DNS_LOOKUP_FAILED";

export class SandboxNetworkPolicyError
  extends Error {
  public readonly code:
    SandboxNetworkPolicyErrorCode;

  public constructor(
    code:
      SandboxNetworkPolicyErrorCode,
    message: string
  ) {
    super(message);
    this.name =
      "SandboxNetworkPolicyError";
    this.code = code;
  }
}

export interface SandboxDnsResolver {
  resolve(
    hostname: string
  ): Promise<readonly string[]>;
}

export interface SandboxNetworkPolicyOptions {
  allowedHostnames?:
    readonly string[];
  trustedHostnames?:
    readonly string[];
  allowedPorts?:
    readonly number[];
  resolver?: SandboxDnsResolver;
}

class NodeSandboxDnsResolver
  implements SandboxDnsResolver {
  public async resolve(
    hostname: string
  ): Promise<readonly string[]> {
    const result =
      await dns.lookup(
        hostname,
        {
          all: true,
          verbatim: true
        }
      );

    return result.map(
      (entry) => entry.address
    );
  }
}

function normalizedHostname(
  hostname: string
): string {
  return hostname
    .toLowerCase()
    .replace(/^\[/, "")
    .replace(/\]$/, "")
    .replace(/\.$/, "");
}

function ipv4Parts(
  address: string
): readonly number[] | undefined {
  const parts =
    address.split(".");

  if (parts.length !== 4) {
    return undefined;
  }

  const values =
    parts.map((part) =>
      Number(part)
    );

  if (
    values.some(
      (value) =>
        !Number.isInteger(value) ||
        value < 0 ||
        value > 255
    )
  ) {
    return undefined;
  }

  return values;
}

function blockedIpv4(
  address: string
): boolean {
  const parts =
    ipv4Parts(address);

  if (parts === undefined) {
    return true;
  }

  const [a, b, c] = parts;

  if (
    a === undefined ||
    b === undefined ||
    c === undefined
  ) {
    return true;
  }

  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (
      a === 100 &&
      b >= 64 &&
      b <= 127
    ) ||
    (
      a === 169 &&
      b === 254
    ) ||
    (
      a === 172 &&
      b >= 16 &&
      b <= 31
    ) ||
    (
      a === 192 &&
      b === 0
    ) ||
    (
      a === 192 &&
      b === 168
    ) ||
    (
      a === 192 &&
      b === 0 &&
      c === 2
    ) ||
    (
      a === 198 &&
      (
        b === 18 ||
        b === 19
      )
    ) ||
    (
      a === 198 &&
      b === 51 &&
      c === 100
    ) ||
    (
      a === 203 &&
      b === 0 &&
      c === 113
    ) ||
    a >= 224
  );
}

function blockedIpv6(
  address: string
): boolean {
  const value =
    address.toLowerCase();

  if (
    value === "::" ||
    value === "::1"
  ) {
    return true;
  }

  if (
    value.startsWith(
      "::ffff:"
    )
  ) {
    const mapped =
      value.slice(
        "::ffff:".length
      );

    return (
      isIP(mapped) !== 4 ||
      blockedIpv4(mapped)
    );
  }

  const first =
    Number.parseInt(
      value.split(":")[0] ?? "",
      16
    );

  if (!Number.isFinite(first)) {
    return true;
  }

  if (
    (
      first >= 0xfc00 &&
      first <= 0xfdff
    ) ||
    (
      first >= 0xfe80 &&
      first <= 0xfebf
    ) ||
    (
      first >= 0xff00 &&
      first <= 0xffff
    )
  ) {
    return true;
  }

  if (
    value.startsWith(
      "2001:db8:"
    ) ||
    value === "2001:db8::"
  ) {
    return true;
  }

  // Default-deny IPv6 ranges that are not global unicast 2000::/3.
  return !(
    first >= 0x2000 &&
    first <= 0x3fff
  );
}

export function isBlockedNetworkAddress(
  address: string
): boolean {
  const version = isIP(address);

  if (version === 4) {
    return blockedIpv4(address);
  }

  if (version === 6) {
    return blockedIpv6(address);
  }

  return true;
}

function reservedHostname(
  hostname: string
): boolean {
  return (
    hostname === "localhost" ||
    hostname.endsWith(
      ".localhost"
    ) ||
    hostname.endsWith(
      ".local"
    ) ||
    hostname.endsWith(
      ".internal"
    ) ||
    hostname ===
      "metadata.google.internal" ||
    hostname === "metadata"
  );
}

export class DefaultSandboxNetworkPolicy
  implements BrowserNetworkPolicy {
  readonly #allowedHostnames:
    ReadonlySet<string>;
  readonly #trustedHostnames:
    ReadonlySet<string>;
  readonly #allowedPorts:
    ReadonlySet<number>;
  readonly #resolver:
    SandboxDnsResolver;

  public readonly domainPolicy;

  public constructor({
    allowedHostnames = [],
    trustedHostnames = [],
    allowedPorts = [80, 443],
    resolver =
      new NodeSandboxDnsResolver()
  }: SandboxNetworkPolicyOptions = {}) {
    this.#allowedHostnames =
      new Set(
        allowedHostnames.map(
          normalizedHostname
        )
      );
    this.#trustedHostnames =
      new Set(
        trustedHostnames.map(
          normalizedHostname
        )
      );
    this.#allowedPorts =
      new Set(allowedPorts);
    this.#resolver = resolver;

    const explicitDomains = [
      ...this.#allowedHostnames,
      ...this.#trustedHostnames
    ];

    this.domainPolicy = {
      allowedDomains:
        explicitDomains.length > 0
          ? explicitDomains
          : [
              "astra-deny-all.invalid"
            ]
    };
  }

  public async assertAllowed(
    request: BrowserNetworkRequest
  ): Promise<void> {
    let url: URL;

    try {
      url = new URL(request.url);
    } catch {
      throw new SandboxNetworkPolicyError(
        "BLOCKED_HOSTNAME",
        "Network request URL is invalid."
      );
    }

    if (
      url.protocol !== "http:" &&
      url.protocol !== "https:"
    ) {
      throw new SandboxNetworkPolicyError(
        "DISALLOWED_SCHEME",
        `Network scheme ${url.protocol} is not allowed.`
      );
    }

    if (
      url.username.length > 0 ||
      url.password.length > 0
    ) {
      throw new SandboxNetworkPolicyError(
        "URL_CREDENTIALS",
        "URL credentials are not allowed."
      );
    }

    const hostname =
      normalizedHostname(
        url.hostname
      );
    const trusted =
      this.#trustedHostnames.has(
        hostname
      );
    const allowed =
      this.#allowedHostnames.has(
        hostname
      ) ||
      trusted;

    if (!allowed) {
      throw new SandboxNetworkPolicyError(
        "BLOCKED_HOSTNAME",
        `Hostname ${hostname} is outside the sandbox egress allowlist.`
      );
    }

    if (!trusted) {
      if (
        reservedHostname(
          hostname
        )
      ) {
        throw new SandboxNetworkPolicyError(
          "BLOCKED_HOSTNAME",
          `Hostname ${hostname} is not allowed.`
        );
      }

      const port =
        url.port.length === 0
          ? (
              url.protocol ===
                "https:"
                ? 443
                : 80
            )
          : Number(url.port);

      if (
        !this.#allowedPorts.has(
          port
        )
      ) {
        throw new SandboxNetworkPolicyError(
          "BLOCKED_PORT",
          `Network port ${String(port)} is not allowed.`
        );
      }

      if (isIP(hostname) !== 0) {
        if (
          isBlockedNetworkAddress(
            hostname
          )
        ) {
          throw new SandboxNetworkPolicyError(
            "BLOCKED_ADDRESS",
            `Network address ${hostname} is not allowed.`
          );
        }

        return;
      }

      let addresses:
        readonly string[];

      try {
        addresses =
          await this.#resolver.resolve(
            hostname
          );
      } catch {
        throw new SandboxNetworkPolicyError(
          "DNS_LOOKUP_FAILED",
          `DNS lookup failed for ${hostname}.`
        );
      }

      if (addresses.length === 0) {
        throw new SandboxNetworkPolicyError(
          "DNS_LOOKUP_FAILED",
          `DNS lookup returned no addresses for ${hostname}.`
        );
      }

      const blocked =
        addresses.find(
          isBlockedNetworkAddress
        );

      if (blocked !== undefined) {
        throw new SandboxNetworkPolicyError(
          "BLOCKED_ADDRESS",
          `Hostname ${hostname} resolved to a blocked network address.`
        );
      }
    }
  }
}
