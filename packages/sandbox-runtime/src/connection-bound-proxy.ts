import {
  createServer,
  request as httpRequest,
  type IncomingHttpHeaders,
  type IncomingMessage,
  type Server,
  type ServerResponse
} from "node:http";
import {
  request as httpsRequest
} from "node:https";
import {
  connect as connectSocket,
  type AddressInfo,
  type Socket
} from "node:net";
import type {
  Duplex
} from "node:stream";

import type {
  DefaultSandboxNetworkPolicy,
  ResolvedSandboxNetworkTarget
} from "./network-policy.js";

export interface ConnectionBoundEgressProxyOptions {
  browserHostname: string;
  listenHostname?: string;
  connectTimeoutMs?: number;
  trustedConnectionOverrides?:
    Readonly<
      Record<
        string,
        string
      >
    >;
}

function normalizedHostname(
  value: string
): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\.$/, "");
}

function safeBrowserHostname(
  value: string
): string {
  const hostname =
    normalizedHostname(
      value
    );

  if (
    hostname.length === 0 ||
    hostname.length > 253 ||
    !/^[a-z0-9.-]+$/.test(
      hostname
    )
  ) {
    throw new TypeError(
      "Connection-bound proxy browserHostname must be a hostname or IPv4 literal without a scheme or port."
    );
  }

  return hostname;
}

function positiveTimeout(
  value: number
): number {
  if (
    !Number.isInteger(value) ||
    value < 1
  ) {
    throw new RangeError(
      "Connection-bound proxy connectTimeoutMs must be a positive integer."
    );
  }

  return value;
}

function targetAddress(
  target:
    ResolvedSandboxNetworkTarget,
  trustedOverrides:
    ReadonlyMap<
      string,
      string
    >
): string {
  if (target.trusted) {
    return (
      trustedOverrides.get(
        target.hostname
      ) ??
      target.addresses[0] ??
      target.hostname
    );
  }

  const address =
    target.addresses[0];

  if (address === undefined) {
    throw new Error(
      "Network policy approved a target without a connection address."
    );
  }

  return address;
}

function sanitizedHeaders(
  headers:
    IncomingHttpHeaders,
  host: string
): IncomingHttpHeaders {
  const output:
    IncomingHttpHeaders = {
      ...headers,
      host
    };

  for (const name of [
    "proxy-authorization",
    "proxy-connection",
    "connection",
    "keep-alive",
    "te",
    "trailer",
    "transfer-encoding",
    "upgrade"
  ]) {
    delete output[name];
  }

  return output;
}

function proxyRequestUrl(
  request:
    IncomingMessage
): URL {
  const raw =
    request.url ??
    "";

  if (
    raw.startsWith(
      "http://"
    ) ||
    raw.startsWith(
      "https://"
    )
  ) {
    return new URL(raw);
  }

  const host =
    request.headers.host;

  if (
    host === undefined ||
    host.length === 0
  ) {
    throw new Error(
      "Proxy request is missing Host."
    );
  }

  return new URL(
    raw.length === 0
      ? "/"
      : raw,
    "http://" + host
  );
}

function connectRequestUrl(
  authority: string
): URL {
  const url =
    new URL(
      "https://" +
        authority +
        "/"
    );

  if (
    url.username.length > 0 ||
    url.password.length > 0
  ) {
    throw new Error(
      "CONNECT authority must not contain credentials."
    );
  }

  return url;
}

export class ConnectionBoundEgressProxy {
  readonly #server:
    Server;
  readonly #policy:
    DefaultSandboxNetworkPolicy;
  readonly #connectTimeoutMs:
    number;
  readonly #trustedOverrides:
    ReadonlyMap<
      string,
      string
    >;
  readonly #sockets =
    new Set<Duplex>();
  #closePromise?:
    Promise<void>;

  public readonly proxyUrl:
    string;

  private constructor(
    server: Server,
    policy:
      DefaultSandboxNetworkPolicy,
    browserHostname: string,
    port: number,
    connectTimeoutMs: number,
    trustedOverrides:
      ReadonlyMap<
        string,
        string
      >
  ) {
    this.#server = server;
    this.#policy = policy;
    this.#connectTimeoutMs =
      connectTimeoutMs;
    this.#trustedOverrides =
      trustedOverrides;
    this.proxyUrl =
      "http://" +
      browserHostname +
      ":" +
      String(port);
  }

  public static async start(
    policy:
      DefaultSandboxNetworkPolicy,
    {
      browserHostname,
      listenHostname =
        "127.0.0.1",
      connectTimeoutMs =
        10_000,
      trustedConnectionOverrides =
        {}
    }:
      ConnectionBoundEgressProxyOptions
  ): Promise<ConnectionBoundEgressProxy> {
    const browserHost =
      safeBrowserHostname(
        browserHostname
      );
    const timeout =
      positiveTimeout(
        connectTimeoutMs
      );
    const trustedOverrides =
      new Map(
        Object.entries(
          trustedConnectionOverrides
        ).map(
          ([hostname, address]) => [
            normalizedHostname(
              hostname
            ),
            address.trim()
          ]
        )
      );
    const holder: {
      proxy?:
        ConnectionBoundEgressProxy;
    } = {};
    const server =
      createServer(
        (request, response) => {
          if (
            holder.proxy !==
              undefined
          ) {
            void holder.proxy
              .handleHttp(
                request,
                response
              );
          }
        }
      );

    server.on(
      "connect",
      (
        request,
        socket,
        head
      ) => {
        if (
          holder.proxy !==
            undefined
        ) {
          void holder.proxy
            .handleConnect(
              request,
              socket,
              head
            );
        }
      }
    );

    await new Promise<void>(
      (resolve, reject) => {
        server.once(
          "error",
          reject
        );
        server.listen(
          0,
          listenHostname,
          resolve
        );
      }
    );

    const address =
      server.address();

    if (
      address === null ||
      typeof address ===
        "string"
    ) {
      server.close();
      throw new Error(
        "Connection-bound proxy did not bind a TCP port."
      );
    }

    const proxy =
      new ConnectionBoundEgressProxy(
        server,
        policy,
        browserHost,
        (
          address as
            AddressInfo
        ).port,
        timeout,
        trustedOverrides
      );
    holder.proxy =
      proxy;

    server.on(
      "connection",
      (socket) => {
        proxy.#sockets.add(
          socket
        );
        socket.once(
          "close",
          () => {
            proxy.#sockets.delete(
              socket
            );
          }
        );
      }
    );

    return proxy;
  }

  async #dial(
    target:
      ResolvedSandboxNetworkTarget
  ): Promise<Socket> {
    const address =
      targetAddress(
        target,
        this.#trustedOverrides
      );

    return new Promise<Socket>(
      (resolve, reject) => {
        const socket =
          connectSocket({
            host:
              address,
            port:
              target.port
          });
        let settled =
          false;
        const finish =
          (
            error?:
              Error
          ) => {
            if (settled) {
              return;
            }

            settled = true;
            socket.setTimeout(
              0
            );
            socket.removeAllListeners(
              "connect"
            );
            socket.removeAllListeners(
              "error"
            );
            socket.removeAllListeners(
              "timeout"
            );

            if (
              error ===
                undefined
            ) {
              resolve(
                socket
              );
            } else {
              socket.destroy();
              reject(
                error
              );
            }
          };

        socket.once(
          "connect",
          () => finish()
        );
        socket.once(
          "error",
          (error) =>
            finish(error)
        );
        socket.setTimeout(
          this.#connectTimeoutMs,
          () =>
            finish(
              new Error(
                "Connection-bound proxy upstream connection timed out."
              )
            )
        );
      }
    );
  }

  async handleConnect(
    request:
      IncomingMessage,
    client:
      Duplex,
    head: Buffer
  ): Promise<void> {
    try {
      const url =
        connectRequestUrl(
          request.url ??
            ""
        );
      const target =
        await this.#policy
          .resolveAllowedTarget({
            url:
              url.href,
            isNavigation:
              false
          });
      const upstream =
        await this.#dial(
          target
        );

      this.#sockets.add(
        upstream
      );
      upstream.once(
        "close",
        () =>
          this.#sockets.delete(
            upstream
          )
      );
      upstream.once(
        "error",
        () =>
          client.destroy()
      );
      client.once(
        "error",
        () =>
          upstream.destroy()
      );

      client.write(
        "HTTP/1.1 200 Connection Established\r\n" +
          "Proxy-Agent: Astra\r\n" +
          "\r\n"
      );

      if (
        head.length >
          0
      ) {
        upstream.write(
          head
        );
      }

      client.pipe(
        upstream
      );
      upstream.pipe(
        client
      );
    } catch {
      if (!client.destroyed) {
        client.end(
          "HTTP/1.1 403 Forbidden\r\n" +
            "Connection: close\r\n" +
            "Content-Length: 0\r\n" +
            "\r\n"
        );
      }
    }
  }

  async handleHttp(
    request:
      IncomingMessage,
    response:
      ServerResponse
  ): Promise<void> {
    try {
      const url =
        proxyRequestUrl(
          request
        );
      const target =
        await this.#policy
          .resolveAllowedTarget({
            url:
              url.href,
            isNavigation:
              request.method ===
                "GET"
          });
      const address =
        targetAddress(
          target,
          this.#trustedOverrides
        );
      const factory =
        target.protocol ===
          "https:"
          ? httpsRequest
          : httpRequest;
      const upstream =
        factory({
          protocol:
            target.protocol,
          hostname:
            address,
          port:
            target.port,
          method:
            request.method,
          path:
            url.pathname +
            url.search,
          headers:
            sanitizedHeaders(
              request.headers,
              url.host
            ),
          ...(target.protocol ===
            "https:"
            ? {
                servername:
                  target.hostname
              }
            : {}),
          agent: false
        });

      upstream.once(
        "error",
        () => {
          if (
            !response.headersSent
          ) {
            response.writeHead(
              502,
              {
                connection:
                  "close"
              }
            );
          }

          response.end();
        }
      );
      upstream.once(
        "response",
        (
          upstreamResponse
        ) => {
          response.writeHead(
            upstreamResponse
              .statusCode ??
              502,
            upstreamResponse
              .headers
          );
          upstreamResponse.pipe(
            response
          );
        }
      );
      request.pipe(
        upstream
      );
    } catch {
      response.writeHead(
        403,
        {
          connection:
            "close",
          "content-length":
            "0"
        }
      );
      response.end();
    }
  }

  public close():
    Promise<void> {
    this.#closePromise ??=
      this.#closeOnce();

    return this.#closePromise;
  }

  async #closeOnce():
    Promise<void> {
    for (
      const socket of
      this.#sockets
    ) {
      socket.destroy();
    }

    await new Promise<void>(
      (resolve, reject) => {
        this.#server.close(
          (error) => {
            if (
              error ===
                undefined
            ) {
              resolve();
            } else {
              reject(
                error
              );
            }
          }
        );
      }
    );
  }
}
