import { createHash } from "node:crypto";

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(",")}]`;
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  const parts = keys.map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`);
  return `{${parts.join(",")}}`;
}

function hashString(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function computeAICallRequestHash(input: {
  body: unknown;
  fileBuffer?: Buffer;
  fileMimeType?: string;
}): string {
  const bodyPart = stableStringify(input.body);
  const filePart = input.fileBuffer
    ? hashString(input.fileBuffer.toString("base64"))
    : "no-file";
  const mimePart = input.fileMimeType ?? "none";
  return hashString(`${bodyPart}|${filePart}|${mimePart}`);
}
