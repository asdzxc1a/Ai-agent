import { randomUUID } from "node:crypto";
import {
  mkdir,
  readFile,
  readdir,
  writeFile
} from "node:fs/promises";
import { join, resolve } from "node:path";

import {
  encodeRedactedJson,
  redactArtifactMetadata
} from "./redaction.js";
import type {
  ArtifactContent,
  ArtifactRecord,
  ArtifactStore,
  PutArtifactInput,
  PutJsonArtifactInput
} from "./types.js";

const SAFE_SEGMENT =
  /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;

function assertSafeSegment(
  value: string,
  label: string
): void {
  if (!SAFE_SEGMENT.test(value)) {
    throw new Error(
      `${label} contains unsafe path characters.`
    );
  }
}

function parseRecord(
  value: unknown
): ArtifactRecord {
  if (
    value === null ||
    typeof value !== "object"
  ) {
    throw new Error(
      "Artifact metadata is invalid."
    );
  }

  const record =
    value as Partial<ArtifactRecord>;

  if (
    typeof record.id !== "string" ||
    typeof record.runId !== "string" ||
    typeof record.kind !== "string" ||
    typeof record.name !== "string" ||
    typeof record.mediaType !== "string" ||
    typeof record.byteLength !== "number" ||
    typeof record.createdAt !== "string"
  ) {
    throw new Error(
      "Artifact metadata is incomplete."
    );
  }

  return record as ArtifactRecord;
}

export class LocalArtifactStore
  implements ArtifactStore {
  readonly #root: string;

  public constructor(root: string) {
    this.#root = resolve(root);
  }

  #runDir(runId: string): string {
    assertSafeSegment(runId, "runId");
    return join(this.#root, runId);
  }

  #dataPath(
    runId: string,
    artifactId: string
  ): string {
    assertSafeSegment(artifactId, "artifactId");
    return join(
      this.#runDir(runId),
      `${artifactId}.data`
    );
  }

  #metadataPath(
    runId: string,
    artifactId: string
  ): string {
    assertSafeSegment(artifactId, "artifactId");
    return join(
      this.#runDir(runId),
      `${artifactId}.meta.json`
    );
  }

  public async putArtifact(
    input: PutArtifactInput
  ): Promise<ArtifactRecord> {
    const artifactId = randomUUID();
    const runDir = this.#runDir(input.runId);

    await mkdir(runDir, {
      recursive: true
    });

    const record: ArtifactRecord = {
      id: artifactId,
      runId: input.runId,
      kind: input.kind,
      name: input.name,
      mediaType: input.mediaType,
      byteLength: input.data.byteLength,
      createdAt: new Date().toISOString(),
      ...(input.metadata === undefined
        ? {}
        : {
            metadata:
              redactArtifactMetadata(input.metadata)
          })
    };

    await writeFile(
      this.#dataPath(input.runId, artifactId),
      input.data
    );

    await writeFile(
      this.#metadataPath(input.runId, artifactId),
      JSON.stringify(record, null, 2),
      "utf8"
    );

    return structuredClone(record);
  }

  public putJsonArtifact(
    input: PutJsonArtifactInput
  ): Promise<ArtifactRecord> {
    return this.putArtifact({
      runId: input.runId,
      kind: input.kind,
      name: input.name,
      mediaType: "application/json",
      data: encodeRedactedJson(input.value),
      ...(input.metadata === undefined
        ? {}
        : {
            metadata: input.metadata
          })
    });
  }

  public async listArtifacts(
    runId: string
  ): Promise<ArtifactRecord[]> {
    const runDir = this.#runDir(runId);

    let names: string[];

    try {
      names = await readdir(runDir);
    } catch (error) {
      if (
        error instanceof Error &&
        "code" in error &&
        error.code === "ENOENT"
      ) {
        return [];
      }

      throw error;
    }

    const records: ArtifactRecord[] = [];

    for (const name of names) {
      if (!name.endsWith(".meta.json")) {
        continue;
      }

      const raw = await readFile(
        join(runDir, name),
        "utf8"
      );
      records.push(
        parseRecord(JSON.parse(raw) as unknown)
      );
    }

    return records.sort((a, b) =>
      a.createdAt.localeCompare(b.createdAt)
    );
  }

  public async readArtifact(
    runId: string,
    artifactId: string
  ): Promise<ArtifactContent | undefined> {
    const metadataPath =
      this.#metadataPath(runId, artifactId);

    try {
      const [metadata, data] =
        await Promise.all([
          readFile(metadataPath, "utf8"),
          readFile(
            this.#dataPath(runId, artifactId)
          )
        ]);

      const record = parseRecord(
        JSON.parse(metadata) as unknown
      );

      if (
        record.id !== artifactId ||
        record.runId !== runId
      ) {
        throw new Error(
          "Artifact metadata does not match requested path."
        );
      }

      return {
        record,
        data: new Uint8Array(data)
      };
    } catch (error) {
      if (
        error instanceof Error &&
        "code" in error &&
        error.code === "ENOENT"
      ) {
        return undefined;
      }

      throw error;
    }
  }
}
