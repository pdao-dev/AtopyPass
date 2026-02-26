import { createHash } from "node:crypto";
import type { CanonicalRecord } from "@/types";

/**
 * Deterministic JSON.stringify – keys sorted alphabetically.
 * This ensures the same object always produces the same hash.
 */
export function stableStringify(obj: CanonicalRecord): string {
  const sorted = Object.keys(obj)
    .sort()
    .reduce<Record<string, unknown>>((acc, key) => {
      acc[key] = obj[key as keyof CanonicalRecord];
      return acc;
    }, {});
  return JSON.stringify(sorted);
}

/** SHA-256 hex of a canonical record */
export function hashRecord(record: CanonicalRecord): string {
  const json = stableStringify(record);
  return createHash("sha256").update(json, "utf-8").digest("hex");
}
