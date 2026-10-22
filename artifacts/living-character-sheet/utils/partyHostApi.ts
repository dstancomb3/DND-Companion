// Keep host capabilities separate from shareable party codes and watch history.
interface HostTokenStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}
type Request = <T>(path: string, options?: RequestInit) => Promise<T>;
const tokenKey = (code: string) => `party-host-token.v1:${code}`;

export function partyHostApi(request: Request, storage: HostTokenStorage) {
  return {
    async createParty(): Promise<{ code: string }> {
      const { code, hostToken } = await request<{ code: string; hostToken: string }>("/party/create", { method: "POST" });
      if (!hostToken) throw new Error("The server must be updated before creating a hosted party.");
      await storage.setItem(tokenKey(code), hostToken);
      return { code };
    },
    async removePartyMember(memberId: string, code: string): Promise<void> {
      const token = await storage.getItem(tokenKey(code));
      if (!token) throw new Error("Only the device that created this party can remove another player.");
      await request("/party/leave", { method: "DELETE", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ memberId, partyCode: code }) });
    },
    async disbandParty(code: string): Promise<void> {
      const token = await storage.getItem(tokenKey(code));
      if (!token) throw new Error("Only the device that created this party can end it. Older parties must expire or be recreated.");
      await request(`/party/${code}/disband`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      await storage.removeItem(tokenKey(code));
    },
  };
}
