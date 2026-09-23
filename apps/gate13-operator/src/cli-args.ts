export function normalizeGate13CliArgs(
  args: readonly string[]
): string[] {
  return args[0] === "--"
    ? args.slice(1)
    : [...args];
}
