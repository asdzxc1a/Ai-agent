import {
  readFile
} from "node:fs/promises";

import {
  describe,
  expect,
  it
} from "vitest";

import {
  ProspectResearchSelectionUniverseSchema
} from "../src/index.js";

interface UniverseMember {
  ticker: string;
  name: string;
  targetId: string;
}

interface UniverseFile {
  id: string;
  sourceName: string;
  sourceUrl: string;
  sourceAsOfDate: string;
  sourceDeclaredEquityCount:
    number;
  benchmarkUrl: string;
  selectionStrategy:
    "COMPLETE_UNIVERSE";
  members:
    UniverseMember[];
}

const expectedTickers = [
  "AAL",
  "ALGT",
  "ALK",
  "ARCB",
  "CAR",
  "CHRW",
  "CSX",
  "CVLG",
  "DAL",
  "EXPD",
  "FDX",
  "FDXF",
  "FIP",
  "GNK",
  "GXO",
  "HTLD",
  "HTZ",
  "HUBG",
  "JBHT",
  "JBLU",
  "JOBY",
  "KEX",
  "KNX",
  "LSTR",
  "LUV",
  "LYFT",
  "MATX",
  "MRTN",
  "NSC",
  "ODFL",
  "R",
  "RXO",
  "SAIA",
  "SKYW",
  "SNDR",
  "UBER",
  "UHAL B",
  "UAL",
  "ULCC",
  "UNP",
  "UPS",
  "WERN",
  "XPO"
].sort();

async function loadUniverse():
  Promise<UniverseFile> {
  const url =
    new URL(
      "../../../docs/project/data/gate13-us-transportation-universe-2026-09-17.json",
      import.meta.url
    );
  const raw =
    await readFile(
      url,
      "utf8"
    );

  return JSON.parse(
    raw
  ) as UniverseFile;
}

describe(
  "Gate 13 U.S. transportation acceptance universe",
  () => {
    it(
      "freezes the complete 43-equity IYT snapshot without cash or derivatives",
      async () => {
        const universe =
          await loadUniverse();
        const tickers =
          universe.members
            .map(
              (member) =>
                member.ticker
            )
            .sort();
        const targetIds =
          universe.members
            .map(
              (member) =>
                member.targetId
            );

        expect(
          universe
            .sourceAsOfDate
        ).toBe(
          "2026-09-17"
        );
        expect(
          universe
            .sourceDeclaredEquityCount
        ).toBe(43);
        expect(
          universe.members
        ).toHaveLength(43);
        expect(tickers)
          .toEqual(
            expectedTickers
          );
        expect(
          new Set(
            targetIds
          ).size
        ).toBe(43);
        expect(tickers)
          .not.toContain(
            "XTSLA"
          );
        expect(tickers)
          .not.toContain(
            "USD"
          );

        expect(
          ProspectResearchSelectionUniverseSchema
            .parse({
              id:
                universe.id,
              sourceName:
                universe
                  .sourceName,
              sourceUrl:
                universe
                  .sourceUrl,
              methodologyUrl:
                universe
                  .benchmarkUrl,
              sourceAsOfDate:
                universe
                  .sourceAsOfDate,
              sourceDeclaredCount:
                universe
                  .sourceDeclaredEquityCount,
              candidateTargetIds:
                targetIds,
              selectionStrategy:
                universe
                  .selectionStrategy,
              selectionSeed:
                null
            })
            .candidateTargetIds
        ).toEqual(
          targetIds
        );
      }
    );
  }
);
