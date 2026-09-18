import {
  mkdtemp,
  rm
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  afterEach,
  describe,
  expect,
  it
} from "vitest";

import {
  InMemoryArtifactStore,
  LocalArtifactStore
} from "../src/index.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) =>
      rm(root, {
        recursive: true,
        force: true
      })
    )
  );
});

describe("ArtifactStore", () => {
  it("redacts JSON values and metadata in memory", async () => {
    const store = new InMemoryArtifactStore();

    const record = await store.putJsonArtifact({
      runId: "run_123",
      kind: "RUN_SUMMARY",
      name: "summary.json",
      value: {
        url: "https://example.test/?token=super-secret",
        password: "hunter2",
        nested: {
          authorization: "Bearer abc123",
          safe: "visible"
        },
        headers: [
          "Authorization: Basic basic-secret",
          "Cookie: sid=cookie-secret; csrf=csrf-secret",
          "Set-Cookie: session=set-cookie-secret; HttpOnly"
        ],
        quoted: "password=\"space secret\"",
        diagnostic:
          "-----BEGIN PRIVATE KEY-----\nprivate-key-secret\n-----END PRIVATE KEY-----",
        userinfoUrl:
          "https://user:url-password@example.test/?signature=query-signature"
      },
      metadata: {
        api_key: "metadata-secret",
        note: "safe"
      }
    });

    const content = await store.readArtifact(
      "run_123",
      record.id
    );

    expect(content).toBeDefined();

    const json = new TextDecoder().decode(
      content!.data
    );

    expect(json).not.toContain("super-secret");
    expect(json).not.toContain("hunter2");
    expect(json).not.toContain("abc123");
    expect(json).not.toContain("basic-secret");
    expect(json).not.toContain("cookie-secret");
    expect(json).not.toContain("csrf-secret");
    expect(json).not.toContain("set-cookie-secret");
    expect(json).not.toContain("space secret");
    expect(json).not.toContain("private-key-secret");
    expect(json).not.toContain("url-password");
    expect(json).not.toContain("query-signature");
    expect(json).toContain("[REDACTED]");
    expect(
      JSON.stringify(content!.record.metadata)
    ).not.toContain("metadata-secret");
  });

  it("persists local binary artifacts across store instances", async () => {
    const root = await mkdtemp(
      join(tmpdir(), "astra-artifacts-")
    );
    roots.push(root);

    const first = new LocalArtifactStore(root);
    const record = await first.putArtifact({
      runId: "run_abc",
      kind: "SCREENSHOT",
      name: "screen.jpg",
      mediaType: "image/jpeg",
      data: new Uint8Array([
        0xff,
        0xd8,
        0xff,
        0xd9
      ])
    });

    const second = new LocalArtifactStore(root);
    const listed = await second.listArtifacts(
      "run_abc"
    );
    const read = await second.readArtifact(
      "run_abc",
      record.id
    );

    expect(listed).toHaveLength(1);
    expect(read?.record.mediaType).toBe(
      "image/jpeg"
    );
    expect([...read!.data]).toEqual([
      0xff,
      0xd8,
      0xff,
      0xd9
    ]);
  });

  it("persists redacted JSON artifacts across store instances", async () => {
    const root = await mkdtemp(
      join(tmpdir(), "astra-artifacts-")
    );
    roots.push(root);

    const first = new LocalArtifactStore(root);
    const record = await first.putJsonArtifact({
      runId: "run_json",
      kind: "RUN_SUMMARY",
      name: "summary.json",
      value: {
        status: "COMPLETED",
        token: "json-secret"
      },
      metadata: {
        password: "metadata-password"
      }
    });

    const second = new LocalArtifactStore(root);
    const read = await second.readArtifact(
      "run_json",
      record.id
    );

    expect(read?.record.mediaType).toBe(
      "application/json"
    );

    const text = new TextDecoder().decode(
      read!.data
    );

    expect(text).toContain("COMPLETED");
    expect(text).not.toContain("json-secret");
    expect(
      JSON.stringify(read!.record.metadata)
    ).not.toContain("metadata-password");
  });

  it("rejects path traversal segments", async () => {
    const root = await mkdtemp(
      join(tmpdir(), "astra-artifacts-")
    );
    roots.push(root);

    const store = new LocalArtifactStore(root);

    await expect(
      store.listArtifacts("../escape")
    ).rejects.toThrow(
      "unsafe path characters"
    );

    await expect(
      store.readArtifact(
        "run_safe",
        "../artifact"
      )
    ).rejects.toThrow(
      "unsafe path characters"
    );
  });
});
