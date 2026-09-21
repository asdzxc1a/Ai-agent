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

async function withGate13DatabaseMode<T>(
  migrate: boolean,
  operation:
    (
      context:
        Gate13DatabaseContext
    ) => Promise<T>
): Promise<T> {
  const connectionString =
    requiredEnv(
      "GATE13_DATABASE_URL"
    );
  const pool =
    createProspectPostgresPool({
      connectionString
    });

  try {
    if (migrate) {
      await runProspectPostgresMigrations(
        pool
      );
      await runPostgresMigrations(
        pool
      );
    }

    return await operation({
      repository:
        new PostgresProspectResearchRepository(
          pool
        ),
      runRepository:
        new PostgresRunRepository(
          pool
        )
    });
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
          {
            getRun:
              (runId) =>
                context
                  .runRepository
                  .getRun(
                    runId
                  )
          }
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
          {
            getRun:
              (runId) =>
                context
                  .runRepository
                  .getRun(
                    runId
                  )
          }
        );

      return operation({
        ...context,
        service
      });
    }
  );
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

  return withGate13Database(
    async (
      context
    ) => {
      const service =
        new ProspectResearchService(
          context.repository,
          artifactStore,
          {
            getRun:
              (runId) =>
                context
                  .runRepository
                  .getRun(
                    runId
                  )
          }
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

      return operation({
        ...context,
        artifactStore,
        service,
        workflow
      });
    }
  );
}
