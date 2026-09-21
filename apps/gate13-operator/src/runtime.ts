import {
  StagehandAgentRuntime
} from "@astra/agent-stagehand";
import {
  InMemoryArtifactStore,
  LocalArtifactStore
} from "@astra/artifact-store";
import {
  SteelBrowserRuntime
} from "@astra/browser-steel";
import {
  createProspectPostgresPool,
  PostgresProspectResearchRepository,
  runProspectPostgresMigrations
} from "@astra/prospect-postgres";
import {
  ProspectResearchService,
  ProspectResearchWorkflow
} from "@astra/prospect-research";
import {
  PostgresRunRepository,
  runPostgresMigrations
} from "@astra/run-postgres";

import {
  acquireGate13RunOwnership,
  releaseGate13RunOwnership
} from "./operator-lock.js";

export interface Gate13DatabaseContext {
  repository:
    PostgresProspectResearchRepository;
  runRepository:
    PostgresRunRepository;
}

export interface Gate13ReviewContext
  extends Gate13DatabaseContext {
  artifactStore:
    LocalArtifactStore;
  service:
    ProspectResearchService;
}

export interface Gate13WorkflowContext
  extends Gate13ReviewContext {
  workflow:
    ProspectResearchWorkflow;
}

function requiredEnv(
  name: string
): string {
  const value =
    process.env[name];

  if (
    value === undefined ||
    value.trim().length === 0
  ) {
    throw new Error(
      name +
        " is required for this Gate 13 operator command."
    );
  }

  return value.trim();
}

function optionalEnv(
  name: string
): string | undefined {
  const value =
    process.env[name];

  if (
    value === undefined ||
    value.trim().length === 0
  ) {
    return undefined;
  }

  return value.trim();
}

export function gate13ArtifactDir():
  string {
  return requiredEnv(
    "GATE13_ARTIFACT_DIR"
  );
}

function gate13Pool() {
  return createProspectPostgresPool({
    connectionString:
      requiredEnv(
        "GATE13_DATABASE_URL"
      )
  });
}

function databaseContext(
  pool:
    ReturnType<
      typeof createProspectPostgresPool
    >
): Gate13DatabaseContext {
  return {
    repository:
      new PostgresProspectResearchRepository(
        pool
      ),
    runRepository:
      new PostgresRunRepository(
        pool
      )
  };
}

async function migrateGate13(
  pool:
    ReturnType<
      typeof createProspectPostgresPool
    >
): Promise<void> {
  await runProspectPostgresMigrations(
    pool
  );
  await runPostgresMigrations(
    pool
  );
}

async function withGate13DatabaseMode<T>(
  migrate: boolean,
  operation:
    (
      context:
        Gate13DatabaseContext
    ) => Promise<T>
): Promise<T> {
  const pool =
    gate13Pool();

  try {
    if (migrate) {
      await migrateGate13(
        pool
      );
    }

    return await operation(
      databaseContext(
        pool
      )
    );
  } finally {
    await pool.end();
  }
}

export async function withGate13Database<T>(
  operation:
    (
      context:
        Gate13DatabaseContext
    ) => Promise<T>
): Promise<T> {
  return withGate13DatabaseMode(
    true,
    operation
  );
}

export async function withGate13DatabaseReadOnly<T>(
  operation:
    (
      context:
        Gate13DatabaseContext
    ) => Promise<T>
): Promise<T> {
  return withGate13DatabaseMode(
    false,
    operation
  );
}

export async function withGate13ReviewContext<T>(
  operation:
    (
      context:
        Gate13ReviewContext
    ) => Promise<T>
): Promise<T> {
  const artifactStore =
    new LocalArtifactStore(
      gate13ArtifactDir()
    );

  return withGate13Database(
    async (
      context
    ) => {
      const service =
        new ProspectResearchService(
          context.repository,
          artifactStore,
          context.runRepository
        );

      return operation({
        ...context,
        artifactStore,
        service
      });
    }
  );
}

export async function withGate13FailureContext<T>(
  operation:
    (
      context: {
        repository:
          PostgresProspectResearchRepository;
        runRepository:
          PostgresRunRepository;
        service:
          ProspectResearchService;
      }
    ) => Promise<T>
): Promise<T> {
  return withGate13Database(
    async (
      context
    ) => {
      const service =
        new ProspectResearchService(
          context.repository,
          new InMemoryArtifactStore(),
          context.runRepository
        );

      return operation({
        ...context,
        service
      });
    }
  );
}

interface Gate13OwnershipClient {
  query(
    sql: string,
    values: unknown[]
  ): Promise<{
    rows:
      Record<
        string,
        unknown
      >[];
  }>;
  release(): void;
}

export async function withGate13Workflow<T>(
  operation:
    (
      context:
        Gate13WorkflowContext
    ) => Promise<T>
): Promise<T> {
  const artifactStore =
    new LocalArtifactStore(
      gate13ArtifactDir()
    );
  const steelBaseUrl =
    requiredEnv(
      "GATE13_STEEL_BASE_URL"
    );
  const modelName =
    requiredEnv(
      "GATE13_MODEL_NAME"
    );
  const apiKey =
    optionalEnv(
      "GATE13_MODEL_API_KEY"
    );
  const baseURL =
    optionalEnv(
      "GATE13_MODEL_BASE_URL"
    );
  const model =
    apiKey === undefined &&
    baseURL === undefined
      ? modelName
      : {
          modelName,
          ...(apiKey ===
            undefined
            ? {}
            : {
                apiKey
              }),
          ...(baseURL ===
            undefined
            ? {}
            : {
                baseURL
              })
        };
  const pool =
    gate13Pool();
  let ownershipClient:
    Gate13OwnershipClient |
    undefined;
  let ownsRun =
    false;
  let completed =
    false;
  let result:
    T | undefined;
  let primaryError:
    unknown;
  let releaseError:
    unknown;
  let clientReleaseError:
    unknown;
  let poolEndError:
    unknown;

  try {
    await migrateGate13(
      pool
    );

    ownershipClient =
      await pool.connect();

    const ownershipQuery =
      (
        sql: string,
        values:
          readonly unknown[]
      ) =>
        ownershipClient!
          .query(
            sql,
            [
              ...values
            ]
          );

    await acquireGate13RunOwnership(
      ownershipQuery
    );
    ownsRun = true;

    const context =
      databaseContext(
        pool
      );
    const service =
      new ProspectResearchService(
        context.repository,
        artifactStore,
        context.runRepository
      );
    const workflow =
      new ProspectResearchWorkflow({
        repository:
          context.repository,
        runRepository:
          context.runRepository,
        artifactStore,
        browserRuntime:
          new SteelBrowserRuntime({
            baseUrl:
              steelBaseUrl
          }),
        agentRuntime:
          new StagehandAgentRuntime({
            model
          })
      });

    result =
      await operation({
        ...context,
        artifactStore,
        service,
        workflow
      });
    completed = true;
  } catch (error) {
    primaryError =
      error;
  }

  if (
    ownershipClient !==
      undefined
  ) {
    if (ownsRun) {
      try {
        await releaseGate13RunOwnership(
          (
            sql,
            values
          ) =>
            ownershipClient!
              .query(
                sql,
                [
                  ...values
                ]
              )
        );
      } catch (error) {
        releaseError =
          error;
      }
    }

    try {
      ownershipClient.release();
    } catch (error) {
      clientReleaseError =
        error;
    }
  }

  try {
    await pool.end();
  } catch (error) {
    poolEndError =
      error;
  }

  const errors:
    unknown[] = [];

  for (
    const error of [
      primaryError,
      releaseError,
      clientReleaseError,
      poolEndError
    ]
  ) {
    if (
      error !==
        undefined
    ) {
      errors.push(
        error
      );
    }
  }

  if (
    errors.length ===
      1
  ) {
    throw errors[0];
  }

  if (
    errors.length >
      1
  ) {
    throw new AggregateError(
      errors,
      "Gate 13 live operator execution and/or ownership cleanup failed."
    );
  }

  if (!completed) {
    throw new Error(
      "Gate 13 live operator execution ended without a result or error."
    );
  }

  return result as T;
}
