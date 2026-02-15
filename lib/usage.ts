const API_BASE = "https://chateqt.com";

export interface UsageData {
  used: number;
  limit: number;
  remaining: number;
  plan: string;
  paymentFailed?: boolean;
  gracePeriod?: boolean;
}

export async function fetchUsage(token: string): Promise<UsageData> {
  const res = await fetch(`${API_BASE}/api/chat/usage`, {
    headers: { Cookie: `chateqt_token=${token}` },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
