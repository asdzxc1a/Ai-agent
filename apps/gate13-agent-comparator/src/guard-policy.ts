import {
  resolve
} from "node:path";

export interface ComparatorBskGuardOptions {
  browserLabel: string;
  allowedDomains:
    readonly string[];
  runDir: string;
}

function optionValue(
  args: readonly string[],
  name: string
): string | undefined {
  const index =
    args.indexOf(
      name
    );

  if (
    index < 0
  ) {
    return undefined;
  }

  return args[
    index + 1
  ];
}

function hostnameAllowed(
  urlText: string,
  allowedDomains:
    readonly string[]
): boolean {
  const url =
    new URL(
      urlText
    );

  if (
    url.protocol !==
      "https:" &&
    url.protocol !==
      "http:"
  ) {
    return false;
  }

  const hostname =
    url.hostname
      .toLowerCase();

  return allowedDomains
    .some(
      (domain) => {
        const normalized =
          domain.toLowerCase();

        return (
          hostname ===
            normalized ||
          hostname.endsWith(
            "." +
              normalized
          )
        );
      }
    );
}

export function validateComparatorBskArgs(
  args: readonly string[],
  options:
    ComparatorBskGuardOptions
): void {
  const [
    command,
    subcommand
  ] = args;

  if (
    command ===
      "session" &&
    subcommand ===
      "start"
  ) {
    if (
      optionValue(
        args,
        "--browser"
      ) !==
        options.browserLabel
    ) {
      throw new Error(
        "Comparator BrowserSkill session must bind the exact dedicated browser label."
      );
    }

    if (
      !args.includes(
        "--json"
      )
    ) {
      throw new Error(
        "Comparator BrowserSkill session start must use --json."
      );
    }

    return;
  }

  if (
    command ===
      "session" &&
    subcommand ===
      "stop"
  ) {
    if (
      args[2] ===
        undefined ||
      args[2].startsWith(
        "--"
      )
    ) {
      throw new Error(
        "Comparator BrowserSkill session stop requires the exact session ID positionally."
      );
    }

    return;
  }

  if (
    command ===
      "navigate"
  ) {
    const url =
      args[1];

    if (
      url === undefined ||
      !hostnameAllowed(
        url,
        options.allowedDomains
      )
    ) {
      throw new Error(
        "Comparator navigation is outside the execution-layer allowlist."
      );
    }

    if (
      optionValue(
        args,
        "--session"
      ) ===
        undefined
    ) {
      throw new Error(
        "Comparator BrowserSkill navigation requires --session."
      );
    }

    return;
  }

  if (
    [
      "observe",
      "snapshot",
      "wheel",
      "scroll-to",
      "navigate-back",
      "navigate-forward",
      "reload",
      "wait-ms"
    ].includes(
      command ?? ""
    )
  ) {
    if (
      optionValue(
        args,
        "--session"
      ) ===
        undefined
    ) {
      throw new Error(
        "Comparator BrowserSkill read-only command requires --session."
      );
    }

    return;
  }

  if (
    command ===
      "screenshot"
  ) {
    if (
      optionValue(
        args,
        "--session"
      ) ===
        undefined
    ) {
      throw new Error(
        "Comparator BrowserSkill screenshot requires --session."
      );
    }

    const out =
      optionValue(
        args,
        "--out"
      );

    if (
      out !== undefined
    ) {
      const absolute =
        resolve(
          out
        );
      const root =
        resolve(
          options.runDir
        );

      if (
        absolute !==
          root &&
        !absolute.startsWith(
          root +
            "/"
        )
      ) {
        throw new Error(
          "Comparator screenshot output must stay inside the run directory."
        );
      }
    }

    return;
  }

  if (
    command ===
      "tab" &&
    subcommand ===
      "list"
  ) {
    return;
  }

  throw new Error(
    "BrowserSkill command is not permitted by the read-only comparator guard: " +
      args.join(
        " "
      )
  );
}
