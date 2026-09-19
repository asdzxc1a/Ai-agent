export type ArtifactKind =
  | "SCREENSHOT"
  | "DIAGNOSTICS"
  | "RUN_SUMMARY"
  | "RESEARCH_EVIDENCE";

export interface ArtifactRecord {
  id: string;
  runId: string;
  kind: ArtifactKind;
  name: string;
  mediaType: string;
  byteLength: number;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export interface ArtifactContent {
  record: ArtifactRecord;
  data: Uint8Array;
}

export interface PutArtifactInput {
  runId: string;
  kind: ArtifactKind;
  name: string;
  mediaType: string;
  data: Uint8Array;
  metadata?: Record<string, unknown>;
}

export interface PutJsonArtifactInput {
  runId: string;
  kind: Exclude<ArtifactKind, "SCREENSHOT">;
  name: string;
  value: unknown;
  metadata?: Record<string, unknown>;
}

export interface ArtifactStore {
  putArtifact(
    input: PutArtifactInput
  ): Promise<ArtifactRecord>;

  putJsonArtifact(
    input: PutJsonArtifactInput
  ): Promise<ArtifactRecord>;

  listArtifacts(
    runId: string
  ): Promise<ArtifactRecord[]>;

  readArtifact(
    runId: string,
    artifactId: string
  ): Promise<ArtifactContent | undefined>;
}
