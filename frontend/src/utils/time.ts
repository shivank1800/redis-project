/**
 * Date formatting helpers.
 *
 * Redis-backed feeds usually return posts in server-generated order. The UI
 * should still render human-friendly relative time so users understand the
 * low-latency behavior ("just now", "2m ago") instead of raw timestamps.
 */

import { formatDistanceToNowStrict } from "date-fns";

export function relativeTime(isoDate: string): string {
  try {
    return `${formatDistanceToNowStrict(new Date(isoDate), { addSuffix: true })}`;
  } catch {
    return "just now";
  }
}

export function epochSecondsFromIso(isoDate: string): number {
  const value = new Date(isoDate).getTime();
  return Number.isFinite(value) ? Math.floor(value / 1000) : Math.floor(Date.now() / 1000);
}
