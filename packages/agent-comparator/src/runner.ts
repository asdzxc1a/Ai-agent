import {
  ComparatorAttemptSchema,
  ComparatorWorkerResultSchema,
  type ComparatorAgentIdentity,
  type ComparatorAttempt,
  type ComparatorProtocol,
  type ComparatorWorkerResult
} from "./schema.js";
import type {
  ComparatorFileStore
} from "./store.js";

export interface ComparatorTarget {
  id: string;
  companyName: string;
  startUrl: string;
  approvedDomains:
    readonly string[];
}

export interface ComparatorWorkerInput {
  attemptId: string;
  target:
    ComparatorTarget;
  protocol:
    ComparatorProtocol;
  signal:
    AbortSignal;
}

export interface ComparatorWorker {
  research(
    input:
      ComparatorWorkerInput
  ): Promise<
    ComparatorWorkerResult
  >;
}

export interface ComparatorFirstAttemptInput {
  store:
    ComparatorFileStore;
  worker:
    ComparatorWorker;
  protocol:
    ComparatorProtocol;
  protocolSha256: string;
  promptSha256: string;
  manifestSha256: string;
  target:
    ComparatorTarget;
  agentIdentity:
    ComparatorAgentIdentity;
  now?:
    () => Date;
  monotonicNow?:
    () => number;
}

function domainAllowed(
  hostname: string,
  allowed:
    readonly string[]
): boolean {
  const normalized =
    hostname.toLowerCase();

  return allowed.some(
    (domain) =>
      normalized ===
        domain.toLowerCase() ||
      normalized.endsWith(
        "." +
          domain.toLowerCase()
      )
  );
}

export function validateComparatorWorkerResult(
  result:
    ComparatorWorkerResult,
  target:
    ComparatorTarget
): ComparatorWorkerResult {
  const parsed =
    ComparatorWorkerResultSchema
      .parse(result);

  for (
    const evidence of
    parsed.evidence
  ) {
    const hostname =
      new URL(
        evidence.url
      ).hostname;

    if (
      !domainAllowed(
        hostname,
        target.approvedDomains
      )
    ) {
      throw new Error(
        "Comparator evidence is outside the target's approved official domains: " +
          evidence.url
      );
    }
  }

  const fieldIds = [
    "companyName",
    "companySummary",
    "transformationOpportunities",
    "buyingSignals"
  ] as const;
  const canonicalBrief = {
    ...parsed.brief
  };

  for (
    const fieldId of
    fieldIds
  ) {
    const field =
      parsed.brief[
        fieldId
      ];
    const evidenceIndexes =
      parsed.evidence
        .map(
          (
            evidence,
            index
          ) =>
            evidence.fieldId ===
              fieldId
              ? index
              : -1
        )
        .filter(
          (index) =>
            index >= 0
        );

    if (
      !field.unknown &&
      evidenceIndexes
        .length === 0
    ) {
      throw new Error(
        "Comparator field has a value without evidence: " +
          fieldId
      );
    }

    canonicalBrief[
      fieldId
    ] = {
      ...field,
      evidenceIndexes:
        field.unknown
          ? []
          : evidenceIndexes
    };
  }

  return ComparatorWorkerResultSchema
    .parse({
      ...parsed,
      brief:
        canonicalBrief
    });
}

function timeoutReason(
  error: unknown
): string {
  if (
    error instanceof DOMException &&
    error.name ===
      "TimeoutError"
  ) {
    return "Comparator wall-clock budget exceeded.";
  }

  return error instanceof Error
    ? error.message
    : String(error);
}

export async function runComparatorFirstAttempt(
  input:
    ComparatorFirstAttemptInput
): Promise<
  ComparatorAttempt
> {
  const now =
    input.now ??
    (() => new Date());
  const monotonicNow =
    input.monotonicNow ??
    (() =>
      performance.now());

  const reservation =
    await input.store.reserve({
      targetId:
        input.target.id,
      protocolSha256:
        input.protocolSha256,
      promptSha256:
        input.promptSha256,
      manifestSha256:
        input.manifestSha256,
      agentIdentity:
        input.agentIdentity
    });
  const startedAt =
    now().toISOString();
  const startedMono =
    monotonicNow();
  const signal =
    AbortSignal.timeout(
      input.protocol
        .execution
        .maxElapsedMs
    );

  try {
    const workerPromise =
      input.worker
        .research({
          attemptId:
            reservation.attemptId,
          target:
            input.target,
          protocol:
            input.protocol,
          signal
        });
    const abortPromise =
      new Promise<never>(
        (_resolve, reject) => {
          const onAbort = () => {
            reject(
              signal.reason ??
                new DOMException(
                  "Comparator run aborted.",
                  "AbortError"
                )
            );
          };

          if (signal.aborted) {
            onAbort();
            return;
          }

          signal.addEventListener(
            "abort",
            onAbort,
            {
              once: true
            }
          );
        }
      );
    const workerResult =
      validateComparatorWorkerResult(
        await Promise.race([
          workerPromise,
          abortPromise
        ]),
        input.target
      );
    const attempt =
      ComparatorAttemptSchema
        .parse({
          protocolVersion:
            input.protocol.version,
          attemptId:
            reservation.attemptId,
          targetId:
            input.target.id,
          status:
            "COMPLETED",
          startedAt,
          finishedAt:
            now().toISOString(),
          elapsedMs:
            Math.max(
              0,
              Math.round(
                monotonicNow() -
                  startedMono
              )
            ),
          failureReason:
            null,
          workerResult,
          humanBaselineMinutes:
            null,
          humanReviewMinutes:
            null,
          reviewType:
            "NOT_REVIEWED",
          operatorInterventions:
            0,
          agentIdentity:
            input.agentIdentity
        });

    return input.store
      .finalize(
        attempt
      );
  } catch (error) {
    const timedOut =
      signal.aborted;
    const attempt =
      ComparatorAttemptSchema
        .parse({
          protocolVersion:
            input.protocol.version,
          attemptId:
            reservation.attemptId,
          targetId:
            input.target.id,
          status:
            timedOut
              ? "TIMED_OUT"
              : "FAILED",
          startedAt,
          finishedAt:
            now().toISOString(),
          elapsedMs:
            Math.max(
              0,
              Math.round(
                monotonicNow() -
                  startedMono
              )
            ),
          failureReason:
            timeoutReason(
              signal.reason ??
              error
            ),
          workerResult:
            null,
          humanBaselineMinutes:
            null,
          humanReviewMinutes:
            null,
          reviewType:
            "NOT_REVIEWED",
          operatorInterventions:
            0,
          agentIdentity:
            input.agentIdentity
        });

    await input.store
      .finalize(
        attempt
      );

    return attempt;
  }
}
