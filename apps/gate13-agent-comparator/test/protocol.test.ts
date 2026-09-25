import {
  expect,
  test
} from "vitest";

import {
  loadFrozenComparatorInputs
} from "../src/protocol.js";

test(
  "checked-in comparator protocol is exact-manifest bound and does not claim human measurement",
  async () => {
    const inputs =
      await loadFrozenComparatorInputs();

    expect(
      inputs
        .protocol
        .sourceManifest
        .targetCount
    ).toBe(43);
    expect(
      inputs.manifestSha256
    ).toBe(
      "9b050c12d784f8476ca0f80cbdb9e425b634b9d2c484730ac1617c025dcec109"
    );
    expect(
      inputs.protocol
        .humanBaseline
    ).toBe(
      "NOT_MEASURED"
    );
    expect(
      inputs.protocol
        .humanReview
    ).toBe(
      "NOT_PERFORMED"
    );
    expect(
      inputs.protocol
        .execution
        .retries
    ).toBe(0);
    expect(
      inputs.protocol
        .browser
        .enforcement
    ).toBe(
      "CONNECTION_BOUND_PROXY_AND_GUARDED_BSK"
    );
    expect(
      inputs.protocol
        .browser
        .credentialStore
    ).toBe(
      "MOCK_KEYCHAIN"
    );
    expect(
      inputs.protocol
        .browser
        .systemKeychainAccess
    ).toBe(
      "FORBIDDEN"
    );
    expect(
      inputs.protocol
        .review
        .model
    ).toBe(
      "gpt-5.6-luna"
    );
    expect(
      inputs.protocol
        .review
        .blindInput
    ).toBe(
      "BRIEF_AND_EVIDENCE_ONLY"
    );
    expect(
      inputs.promptSha256
    ).toBe(
      inputs.protocol
        .agent
        .promptSha256
    );
    expect(
      inputs.reviewPromptSha256
    ).toBe(
      inputs.protocol
        .review
        .promptSha256
    );
    expect(
      inputs.costPlanSha256
    ).toBe(
      inputs.protocol
        .costAccounting
        .sha256
    );
    expect(
      inputs.costPlan
        .accounting
    ).toBe(
      "REFERENCE_API_EQUIVALENT_NOT_ACTUAL_BILL"
    );
  }
);
