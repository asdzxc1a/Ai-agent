import {
  describe,
  expect,
  test
} from "vitest";

import {
  validateComparatorBskArgs
} from "../src/guard-policy.js";

const options = {
  browserLabel:
    "astra-agent-comparator",
  allowedDomains: [
    "fixture.test",
    "duckduckgo.com"
  ],
  runDir:
    "/tmp/comparator-run"
};

describe(
  "comparator BrowserSkill guard",
  () => {
    test(
      "permits only the exact dedicated browser and allowlisted read-only navigation",
      () => {
        expect(
          () =>
            validateComparatorBskArgs(
              [
                "session",
                "start",
                "--browser",
                "astra-agent-comparator",
                "--json"
              ],
              options
            )
        ).not.toThrow();

        expect(
          () =>
            validateComparatorBskArgs(
              [
                "navigate",
                "https://news.fixture.test/about",
                "--session",
                "s1"
              ],
              options
            )
        ).not.toThrow();

        expect(
          () =>
            validateComparatorBskArgs(
              [
                "navigate",
                "https://duckduckgo.com/?q=site%3Afixture.test",
                "--session",
                "s1"
              ],
              options
            )
        ).not.toThrow();
      }
    );

    test(
      "blocks side-effect commands, non-approved destinations, wrong profiles, and escaping screenshots",
      () => {
        expect(
          () =>
            validateComparatorBskArgs(
              [
                "session",
                "start",
                "--browser",
                "personal-profile"
              ],
              options
            )
        ).toThrow(
          "exact dedicated browser label"
        );

        expect(
          () =>
            validateComparatorBskArgs(
              [
                "navigate",
                "https://third-party.test/article",
                "--session",
                "s1"
              ],
              options
            )
        ).toThrow(
          "outside the execution-layer allowlist"
        );

        for (
          const command of [
            "click",
            "fill",
            "press",
            "upload",
            "download",
            "evaluate",
            "request-help"
          ]
        ) {
          expect(
            () =>
              validateComparatorBskArgs(
                [
                  command,
                  "@e1",
                  "--session",
                  "s1"
                ],
                options
              )
          ).toThrow(
            "not permitted"
          );
        }

        expect(
          () =>
            validateComparatorBskArgs(
              [
                "screenshot",
                "--session",
                "s1",
                "--out",
                "/tmp/outside.png"
              ],
              options
            )
        ).toThrow(
          "must stay inside"
        );
      }
    );
  }
);
