import { fetchSecrets } from "./fetch";
import type { OpaqueConfig, SecretsRecord } from "./types";

export interface WatchOptions extends OpaqueConfig {
  interval?: number; // ms, default 60_000
  onUpdate: (secrets: SecretsRecord) => void;
  onError?: (err: Error) => void;
}

export function watchSecrets(opts: WatchOptions): () => void {
  const interval = opts.interval ?? 60_000;

  const poll = async (): Promise<void> => {
    try {
      opts.onUpdate(await fetchSecrets(opts));
    } catch (err) {
      opts.onError?.(err as Error);
    }
  };

  void poll();
  const timer = setInterval(() => void poll(), interval);
  return () => clearInterval(timer);
}
