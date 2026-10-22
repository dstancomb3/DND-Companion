import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export function hashPartyHostToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function issuePartyHostToken(): { hostToken: string; hostTokenHash: string } {
  const hostToken = randomBytes(32).toString("hex");
  return { hostToken, hostTokenHash: hashPartyHostToken(hostToken) };
}

export function hasPartyHostToken(header: string | undefined, storedHash: string | null | undefined): boolean {
  if (!storedHash || !/^[a-f0-9]{64}$/.test(storedHash)) return false;
  const match = /^Bearer ([a-f0-9]{64})$/.exec(header ?? "");
  if (!match) return false;
  return timingSafeEqual(Buffer.from(hashPartyHostToken(match[1]), "hex"), Buffer.from(storedHash, "hex"));
}
