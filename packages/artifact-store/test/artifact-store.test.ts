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
        }
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
