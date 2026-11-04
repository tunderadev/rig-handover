import { readdirSync } from 'node:fs';
import type { RigConfig } from './config.js';
import { readNight } from './digest/read.js';
import type { StatusCounts } from './digest/types.js';
import { lastBeat, type Beat } from './heartbeat.js';

export type Status = {
  adapter: string;
  installed: string;
  lastBeat: Beat | null;
  nights: NightSummary[];
};

export type NightSummary = { night: string; counts: StatusCounts; badLines: number };

// Nights on disk = runs/<YYYY-MM-DD>.jsonl, newest first.
export function nightsOnDisk(runsDir: string): string[] {
  try {
    return readdirSync(runsDir)
      .filter((f) => /^\d{4}-\d{2}-\d{2}\.jsonl$/.test(f))
      .map((f) => f.slice(0, 10))
      .sort()
      .reverse();
  } catch {
    return [];
  }
}

export function readStatus(config: RigConfig): Status {
  return {
    adapter: config.adapter,
    installed: config.installed,
    lastBeat: lastBeat(),
    nights: nightSummaries(config.runsDir),
  };
}

// Per-line counts come from the digest reader, so the board and the digest agree.
export function nightSummaries(runsDir: string): NightSummary[] {
  return nightsOnDisk(runsDir).flatMap((night) => {
    const read = readNight(runsDir, night);
    // The file vanished between the listing and the read: nothing to link to.
    return read ? [{ night, counts: read.counts, badLines: read.badLines }] : [];
  });
}
