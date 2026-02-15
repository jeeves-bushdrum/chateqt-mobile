const BASE_URL = "https://chateqt.com/api/v1";
const API_KEY = process.env.EXPO_PUBLIC_API_KEY || "";

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: { research: any[]; web: any[] };
  created_at: string;
}

export interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

function headers(userEmail: string): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "X-API-Key": API_KEY,
    "X-User-Email": userEmail,
  };
}

export async function listConversations(
  userEmail: string
): Promise<Conversation[]> {
  const res = await fetch(`${BASE_URL}/conversations`, {
    headers: headers(userEmail),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return data.conversations;
}

export async function getConversation(
  id: string,
  userEmail: string
): Promise<{ conversation: Conversation; messages: Message[] }> {
  const res = await fetch(`${BASE_URL}/conversations/${id}`, {
    headers: headers(userEmail),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function createConversation(
  userEmail: string,
  title?: string
): Promise<Conversation> {
  const res = await fetch(`${BASE_URL}/conversations`, {
    method: "POST",
    headers: headers(userEmail),
    body: JSON.stringify({ title }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return data.conversation;
}

export async function deleteConversation(
  id: string,
  userEmail: string
): Promise<void> {
  const res = await fetch(`${BASE_URL}/conversations/${id}`, {
    method: "DELETE",
    headers: headers(userEmail),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}

export interface ChatStreamCallbacks {
  onStatus?: (stage: string, data?: any) => void;
  onDelta?: (text: string) => void;
  onSources?: (sources: { research: any[]; web: any[] }) => void;
  onDone?: (conversationId: string) => void;
  onError?: (error: string) => void;
}

export async function streamChat(
  query: string,
  userEmail: string,
  conversationId: string | null,
  messages: { role: string; content: string }[],
  callbacks: ChatStreamCallbacks
): Promise<void> {
  const res = await fetch(`${BASE_URL}/chat`, {
    method: "POST",
    headers: headers(userEmail),
    body: JSON.stringify({
      query,
      conversation_id: conversationId,
      messages,
    }),
  });

  if (!res.ok) {
    callbacks.onError?.(`HTTP ${res.status}`);
    return;
  }

  const reader = res.body?.getReader();
  if (!reader) {
    callbacks.onError?.("No response body");
    return;
  }

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    let currentEvent = "";
    for (const line of lines) {
      if (line.startsWith("event: ")) {
        currentEvent = line.slice(7).trim();
      } else if (line.startsWith("data: ")) {
        const payload = line.slice(6).trim();
        try {
          const parsed = JSON.parse(payload);
          switch (currentEvent) {
            case "status":
              callbacks.onStatus?.(parsed.stage, parsed);
              break;
            case "delta":
              callbacks.onDelta?.(parsed.text);
              break;
            case "sources":
              callbacks.onSources?.(parsed);
              break;
            case "done":
              callbacks.onDone?.(parsed.conversation_id);
              break;
          }
        } catch {}
        currentEvent = "";
      }
    }
  }
}
