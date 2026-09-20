import {
  mkdir,
  writeFile
} from "node:fs/promises";
import { dirname } from "node:path";

import {
  runBaselineSalesBench,
  serializeSalesBenchReport
} from "./runner.js";

const outputPath =
  process.env.SALESBENCH_REPORT_PATH ??
  "benchmarks/salesbench/baseline-0.json";

const report =
  runBaselineSalesBench();

await mkdir(
  dirname(outputPath),
  {
    recursive: true
  }
);

await writeFile(
  outputPath,
  serializeSalesBenchReport(report),
  "utf8"
);

process.stdout.write(
  JSON.stringify(
    {
      outputPath,
      scenarioFingerprint:
        report.scenarioFingerprint,
      aggregate:
        report.aggregate
    },
    null,
    2
  ) + "\n"
);
