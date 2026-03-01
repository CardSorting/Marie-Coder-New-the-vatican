export type Layer = "domain" | "infrastructure" | "plumbing" | "ui";

export function getLayer(path: string): Layer {
  const normalized = path.replace(/\\/g, "/");
  if (normalized.startsWith("src/domain/")) return "domain";
  if (normalized.startsWith("src/infrastructure/")) return "infrastructure";
  if (normalized.startsWith("src/plumbing/")) return "plumbing";
  if (normalized.startsWith("src/ui/")) return "ui";
  throw new Error(
    `Invalid layer path: ${path}. Every file must reside in a valid layer directory.`,
  );
}

export function validateLayering(path: string, content: string): void {
  const layer = getLayer(path);

  if (layer === "domain") {
    const forbidden = [
      {
        pattern: "fetch(",
        message: "Network access (fetch) is forbidden in the Domain layer.",
      },
      {
        pattern: "fs.",
        message: "Filesystem access (fs) is forbidden in the Domain layer.",
      },
      {
        pattern: "process.",
        message:
          "Process/Environment access (process) is forbidden in the Domain layer.",
      },
      {
        pattern: "child_process",
        message: "Subprocess execution is forbidden in the Domain layer.",
      },
      {
        pattern: "http",
        message: "HTTP modules are forbidden in the Domain layer.",
      },
    ];

    for (const rule of forbidden) {
      if (content.includes(rule.pattern)) {
        throw new Error(`Architectural Violation in ${path}: ${rule.message}`);
      }
    }
  }
}
