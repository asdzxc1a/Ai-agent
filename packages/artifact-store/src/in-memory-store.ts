import { randomUUID } from "node:crypto";

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

function cloneRecord(
  record: ArtifactRecord
): ArtifactRecord {
  return structuredClone(record);
}

export class InMemoryArtifactStore
  implements ArtifactStore {
  readonly #runs =
    new Map<string, Map<string, ArtifactContent>>();

  public async putArtifact(
    input: PutArtifactInput
  ): Promise<ArtifactRecord> {
    const metadata =
      input.metadata === undefined
        ? undefined
        : redactArtifactMetadata(
            input.metadata
          );

    const record: ArtifactRecord = {
      id: randomUUID(),
      runId: input.runId,
      kind: input.kind,
      name: input.name,
      mediaType: input.mediaType,
      byteLength: input.data.byteLength,
      createdAt: new Date().toISOString(),
      ...(metadata === undefined
        ? {}
        : {
            metadata
          })
    };

    const run =
      this.#runs.get(input.runId) ??
      new Map<string, ArtifactContent>();

    run.set(record.id, {
      record: cloneRecord(record),
      data: new Uint8Array(input.data)
    });
    this.#runs.set(input.runId, run);

    return cloneRecord(record);
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
    return [
      ...(this.#runs.get(runId)?.values() ?? [])
    ]
      .map((content) => cloneRecord(content.record))
      .sort((a, b) =>
        a.createdAt.localeCompare(b.createdAt)
      );
  }

  public async readArtifact(
    runId: string,
    artifactId: string
  ): Promise<ArtifactContent | undefined> {
    const content =
      this.#runs.get(runId)?.get(artifactId);

    if (content === undefined) {
      return undefined;
    }

    return {
      record: cloneRecord(content.record),
      data: new Uint8Array(content.data)
    };
  }
}
