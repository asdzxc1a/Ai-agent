import {
  randomUUID
} from "node:crypto";
import {
  mkdir,
  readFile,
  writeFile
} from "node:fs/promises";
import {
  join
} from "node:path";

import {
  comparatorAttemptSha256,
  ComparatorModelReviewDraftSchema,
  ComparatorModelReviewSchema,
  type ComparatorModelReview,
  type ComparatorModelReviewDraft,
  type ComparatorReviewerIdentity,
  type ComparatorReviewerModelUsage
} from "./review.js";
import {
  ComparatorAttemptSchema,
  ComparatorAuthorizationSchema,
  ComparatorReservationSchema,
  type ComparatorAgentIdentity,
  type ComparatorAttempt,
  type ComparatorAuthorization,
  type ComparatorReservation
} from "./schema.js";

function iso(
  now:
    () => Date
): string {
  return now()
    .toISOString();
}

function safeTargetId(
  targetId: string
): string {
  if (
    !/^[a-zA-Z0-9._-]+$/
      .test(targetId)
  ) {
    throw new Error(
      "Unsafe comparator target ID."
    );
  }

  return targetId;
}

async function readJson<T>(
  path: string,
  parse:
    (input: unknown) => T
): Promise<T | undefined> {
  try {
    return parse(
      JSON.parse(
        await readFile(
          path,
          "utf8"
        )
      )
    );
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

export interface ComparatorReservationInput {
  targetId: string;
  protocolSha256: string;
  promptSha256: string;
  manifestSha256: string;
  agentIdentity:
    ComparatorAgentIdentity;
}

export interface ComparatorModelReviewInput {
  attemptId: string;
  targetId: string;
  protocolSha256: string;
  reviewPromptSha256: string;
  reviewerIdentity:
    ComparatorReviewerIdentity;
  review:
    ComparatorModelReviewDraft;
  modelUsage:
    ComparatorReviewerModelUsage | null;
}

export class ComparatorFileStore {
  readonly #root: string;
  readonly #now:
    () => Date;

  public constructor(
    root: string,
    now:
      () => Date =
        () => new Date()
  ) {
    this.#root = root;
    this.#now = now;
  }

  public get root(): string {
    return this.#root;
  }

  async #ensure(): Promise<void> {
    await Promise.all([
      mkdir(
        this.#root,
        {
          recursive: true
        }
      ),
      mkdir(
        join(
          this.#root,
          "reservations"
        ),
        {
          recursive: true
        }
      ),
      mkdir(
        join(
          this.#root,
          "attempts"
        ),
        {
          recursive: true
        }
      ),
      mkdir(
        join(
          this.#root,
          "reviews"
        ),
        {
          recursive: true
        }
      )
    ]);
  }

  public async authorize(
    input:
      Omit<
        ComparatorAuthorization,
        "authorizedAt"
      >
  ): Promise<
    ComparatorAuthorization
  > {
    await this.#ensure();
    const authorization =
      ComparatorAuthorizationSchema
        .parse({
          ...input,
          authorizedAt:
            iso(this.#now)
        });

    await writeFile(
      join(
        this.#root,
        "authorization.json"
      ),
      JSON.stringify(
        authorization,
        null,
        2
      ) + "\n",
      {
        encoding: "utf8",
        flag: "wx",
        mode: 0o600
      }
    );

    return authorization;
  }

  public async getAuthorization():
    Promise<
      ComparatorAuthorization |
      undefined
    > {
    await this.#ensure();

    return readJson(
      join(
        this.#root,
        "authorization.json"
      ),
      (input) =>
        ComparatorAuthorizationSchema
          .parse(input)
    );
  }

  public async reserve(
    input:
      ComparatorReservationInput
  ): Promise<
    ComparatorReservation
  > {
    await this.#ensure();
    const authorization =
      await this.getAuthorization();

    if (
      authorization ===
        undefined
    ) {
      throw new Error(
        "Comparator protocol is not authorized."
      );
    }

    if (
      authorization.protocolSha256 !==
        input.protocolSha256 ||
      authorization.manifestSha256 !==
        input.manifestSha256
    ) {
      throw new Error(
        "Comparator authorization does not match the frozen protocol/manifest."
      );
    }

    const targetId =
      safeTargetId(
        input.targetId
      );
    const reservation =
      ComparatorReservationSchema
        .parse({
          protocolVersion:
            authorization.protocolVersion,
          targetId,
          attemptId:
            "comparator." +
            randomUUID(),
          reservedAt:
            iso(this.#now),
          protocolSha256:
            input.protocolSha256,
          promptSha256:
            input.promptSha256,
          manifestSha256:
            input.manifestSha256,
          agentIdentity:
            input.agentIdentity
        });

    await writeFile(
      join(
        this.#root,
        "reservations",
        targetId +
          ".json"
      ),
      JSON.stringify(
        reservation,
        null,
        2
      ) + "\n",
      {
        encoding: "utf8",
        flag: "wx",
        mode: 0o600
      }
    );

    return reservation;
  }

  public async getReservation(
    targetId: string
  ): Promise<
    ComparatorReservation |
    undefined
  > {
    await this.#ensure();

    return readJson(
      join(
        this.#root,
        "reservations",
        safeTargetId(
          targetId
        ) +
          ".json"
      ),
      (input) =>
        ComparatorReservationSchema
          .parse(input)
    );
  }

  public async finalize(
    attempt:
      ComparatorAttempt
  ): Promise<
    ComparatorAttempt
  > {
    await this.#ensure();
    const parsed =
      ComparatorAttemptSchema
        .parse(attempt);
    const reservation =
      await this.getReservation(
        parsed.targetId
      );

    if (
      reservation ===
        undefined
    ) {
      throw new Error(
        "Comparator attempt has no durable reservation."
      );
    }

    if (
      reservation.attemptId !==
        parsed.attemptId
    ) {
      throw new Error(
        "Comparator attempt does not match the first-attempt reservation."
      );
    }

    await writeFile(
      join(
        this.#root,
        "attempts",
        safeTargetId(
          parsed.targetId
        ) +
          ".json"
      ),
      JSON.stringify(
        parsed,
        null,
        2
      ) + "\n",
      {
        encoding: "utf8",
        flag: "wx",
        mode: 0o600
      }
    );

    return parsed;
  }

  public async getAttempt(
    targetId: string
  ): Promise<
    ComparatorAttempt |
    undefined
  > {
    await this.#ensure();

    return readJson(
      join(
        this.#root,
        "attempts",
        safeTargetId(
          targetId
        ) +
          ".json"
      ),
      (input) =>
        ComparatorAttemptSchema
          .parse(input)
    );
  }

  public async saveModelReview(
    input:
      ComparatorModelReviewInput
  ): Promise<
    ComparatorModelReview
  > {
    await this.#ensure();
    const [
      attempt,
      reservation
    ] =
      await Promise.all([
        this.getAttempt(
          input.targetId
        ),
        this.getReservation(
          input.targetId
        )
      ]);

    if (
      attempt ===
        undefined
    ) {
      throw new Error(
        "Comparator model review requires a terminal first attempt."
      );
    }

    if (
      reservation ===
        undefined ||
      reservation.attemptId !==
        attempt.attemptId ||
      reservation.protocolSha256 !==
        input.protocolSha256
    ) {
      throw new Error(
        "Comparator model review protocol binding does not match the reserved first attempt."
      );
    }

    if (
      attempt.status !==
        "COMPLETED" ||
      attempt.workerResult ===
        null
    ) {
      throw new Error(
        "Comparator model review is only valid for a completed attempt."
      );
    }

    if (
      attempt.attemptId !==
        input.attemptId
    ) {
      throw new Error(
        "Comparator model review does not reference the target's terminal first attempt."
      );
    }

    const parsedDraft =
      ComparatorModelReviewDraftSchema
        .parse(
          input.review
        );
    const review =
      ComparatorModelReviewSchema
        .parse({
          version:
            "gate13-agent-comparator-model-review-v1",
          reviewType:
            "MODEL_REVIEWED",
          blindInput:
            "BRIEF_AND_EVIDENCE_ONLY",
          attemptId:
            attempt.attemptId,
          targetId:
            attempt.targetId,
          attemptSha256:
            comparatorAttemptSha256(
              attempt
            ),
          protocolSha256:
            input.protocolSha256,
          reviewPromptSha256:
            input.reviewPromptSha256,
          reviewedAt:
            iso(this.#now),
          reviewerIdentity:
            input.reviewerIdentity,
          findings:
            parsedDraft.findings,
          correctionSeverity:
            parsedDraft
              .correctionSeverity,
          usability:
            parsedDraft.usability,
          reviewNote:
            parsedDraft.reviewNote,
          modelUsage:
            input.modelUsage,
          humanReviewMinutes:
            null
        });

    await writeFile(
      join(
        this.#root,
        "reviews",
        safeTargetId(
          review.targetId
        ) +
          ".json"
      ),
      JSON.stringify(
        review,
        null,
        2
      ) +
        "\n",
      {
        encoding:
          "utf8",
        flag:
          "wx",
        mode:
          0o600
      }
    );

    return review;
  }

  public async getModelReview(
    targetId: string
  ): Promise<
    ComparatorModelReview |
    undefined
  > {
    await this.#ensure();

    const review =
      await readJson(
        join(
          this.#root,
          "reviews",
          safeTargetId(
            targetId
          ) +
            ".json"
        ),
        (value) =>
          ComparatorModelReviewSchema
            .parse(
              value
            )
      );

    if (
      review ===
        undefined
    ) {
      return undefined;
    }

    const attempt =
      await this.getAttempt(
        targetId
      );

    if (
      attempt ===
        undefined ||
      comparatorAttemptSha256(
        attempt
      ) !==
        review.attemptSha256 ||
      attempt.attemptId !==
        review.attemptId
    ) {
      throw new Error(
        "Comparator model review no longer matches the immutable terminal attempt."
      );
    }

    return review;
  }

  public async finalizeInterrupted(
    targetId: string,
    reason: string
  ): Promise<
    ComparatorAttempt
  > {
    const reservation =
      await this.getReservation(
        targetId
      );

    if (
      reservation ===
        undefined
    ) {
      throw new Error(
        "Comparator interruption recovery requires an existing reservation."
      );
    }

    if (
      await this.getAttempt(
        targetId
      ) !==
        undefined
    ) {
      throw new Error(
        "Comparator first attempt is already terminal."
      );
    }

    const finishedAt =
      this.#now();
    const elapsedMs =
      Math.max(
        0,
        finishedAt.getTime() -
          new Date(
            reservation.reservedAt
          ).getTime()
      );
    const attempt =
      ComparatorAttemptSchema
        .parse({
          protocolVersion:
            reservation.protocolVersion,
          attemptId:
            reservation.attemptId,
          targetId:
            reservation.targetId,
          status:
            "FAILED",
          startedAt:
            reservation.reservedAt,
          finishedAt:
            finishedAt.toISOString(),
          elapsedMs,
          failureReason:
            "INTERRUPTED: " +
            reason,
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
            reservation
              .agentIdentity
        });

    return this.finalize(
      attempt
    );
  }
}
