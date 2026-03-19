import type { SecretsRecord } from "./types";

export function injectEnv(
  secrets: SecretsRecord,
  target: Record<string, string | undefined>,
  options?: { force?: boolean },
): void {
  for (const [key, value] of Object.entries(secrets)) {
    if (options?.force || target[key] === undefined) {
      target[key] = value;
    }
  }
}
