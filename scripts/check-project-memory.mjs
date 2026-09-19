import {
  access,
  readFile
} from "node:fs/promises";

const REQUIRED_FILES = [
  "AGENTS.md",
  "docs/project/PROJECT_MEMORY_SYSTEM.md",
  "docs/project/STATE.md",
  "docs/project/PLAN.md",
  "docs/project/TEST_STRATEGY.md",
  "docs/project/DECISIONS.md",
  "docs/project/LESSONS.md",
  "docs/project/HANDOFF_PROTOCOL.md",
  ".github/pull_request_template.md"
];

const VALID_GATE_STATUSES = new Set([
  "NOT_STARTED",
  "IN_PROGRESS",
  "BLOCKED",
  "PASSED"
]);

async function read(path) {
  return readFile(path, "utf8");
}

function collectIds(content, prefix) {
  const expression = new RegExp(
    `^## (${prefix}-\\d{3}[A-Z]?) — `,
    "gm"
  );
  return [...content.matchAll(expression)].map(
    (match) => match[1]
  );
}

function duplicates(values) {
  const seen = new Set();
  const repeated = new Set();

  for (const value of values) {
    if (seen.has(value)) {
      repeated.add(value);
    }
    seen.add(value);
  }

  return [...repeated].sort();
}

function parsePlanGates(content) {
  const expression =
    /^## Gate (\d+) — (.+)\r?\n\r?\n\*\*Status:\*\* ([A-Z_]+)/gm;
  const gates = [];

  for (const match of content.matchAll(expression)) {
    gates.push({
      number: Number(match[1]),
      title: match[2].trim(),
      status: match[3]
    });
  }

  return gates;
}

async function main() {
  const errors = [];

  for (const path of REQUIRED_FILES) {
    try {
      await access(path);
    } catch {
      errors.push(`Missing required project-memory file: ${path}`);
    }
  }

  if (errors.length > 0) {
    throw new Error(errors.join("\n"));
  }

  const [
    agents,
    state,
    plan,
    decisions,
    lessons,
    handoff
  ] = await Promise.all([
    read("AGENTS.md"),
    read("docs/project/STATE.md"),
    read("docs/project/PLAN.md"),
    read("docs/project/DECISIONS.md"),
    read("docs/project/LESSONS.md"),
    read("docs/project/HANDOFF_PROTOCOL.md")
  ]);

  const currentGate = state.match(
    /^\*\*Current gate:\*\* Gate (\d+) — (.+)$/m
  );

  if (currentGate === null) {
    errors.push(
      "STATE.md must declare '**Current gate:** Gate N — <title>'."
    );
  }

  if (!/^## Next action\s*$/m.test(state)) {
    errors.push("STATE.md must contain a '## Next action' section.");
  }

  const gates = parsePlanGates(plan);

  if (gates.length === 0) {
    errors.push("PLAN.md contains no parseable gate sections.");
  }

  for (const gate of gates) {
    if (!VALID_GATE_STATUSES.has(gate.status)) {
      errors.push(
        `Gate ${gate.number} has invalid status ${gate.status}.`
      );
    }
  }

  const inProgress = gates.filter(
    (gate) => gate.status === "IN_PROGRESS"
  );

  if (inProgress.length > 1) {
    errors.push(
      `PLAN.md has more than one IN_PROGRESS gate: ${inProgress
        .map((gate) => gate.number)
        .join(", ")}.`
    );
  }

  if (currentGate !== null) {
    const number = Number(currentGate[1]);
    const title = currentGate[2].trim();
    const planned = gates.find(
      (gate) => gate.number === number
    );

    if (planned === undefined) {
      errors.push(
        `STATE.md current Gate ${number} does not exist in PLAN.md.`
      );
    } else if (planned.title !== title) {
      errors.push(
        `STATE.md current gate title "${title}" does not match PLAN.md "${planned.title}".`
      );
    }
  }

  const decisionDuplicates = duplicates(
    collectIds(decisions, "D")
  );
  const lessonDuplicates = duplicates(
    collectIds(lessons, "L")
  );

  if (decisionDuplicates.length > 0) {
    errors.push(
      `Duplicate decision IDs: ${decisionDuplicates.join(", ")}.`
    );
  }

  if (lessonDuplicates.length > 0) {
    errors.push(
      `Duplicate lesson IDs: ${lessonDuplicates.join(", ")}.`
    );
  }

  if (
    !agents.includes(
      "docs/project/PROJECT_MEMORY_SYSTEM.md"
    )
  ) {
    errors.push(
      "AGENTS.md must point to docs/project/PROJECT_MEMORY_SYSTEM.md."
    );
  }

  if (!/active GitHub issue/i.test(agents)) {
    errors.push(
      "AGENTS.md must include the active GitHub issue in fresh-context startup."
    );
  }

  if (!/active GitHub issue/i.test(handoff)) {
    errors.push(
      "HANDOFF_PROTOCOL.md must include the active GitHub issue in startup/handoff guidance."
    );
  }

  if (errors.length > 0) {
    process.stderr.write(
      `Project-memory check failed:\n- ${errors.join("\n- ")}\n`
    );
    process.exitCode = 1;
    return;
  }

  process.stdout.write(
    `Project-memory check passed: ${gates.length} gates, ${collectIds(
      decisions,
      "D"
    ).length} decisions, ${collectIds(
      lessons,
      "L"
    ).length} lessons.\n`
  );
}

await main();
