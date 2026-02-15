import { getToken } from "./auth";

const API_KEY = process.env.EXPO_PUBLIC_API_KEY || "";
const HAS_API_KEY = API_KEY.length > 0;

// When API key is set, use v1 endpoints; otherwise fall back to web API with cookie auth
const V1_BASE = "https://chateqt.com/api/v1";
const WEB_BASE = "https://chateqt.com/api";

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

async function authHeaders(userEmail: string): Promise<Record<string, string>> {
  if (HAS_API_KEY) {
    return {
      "Content-Type": "application/json",
      "X-API-Key": API_KEY,
      "X-User-Email": userEmail,
    };
  }
  // Fall back to Bearer token auth (mobile-friendly, no cookie issues)
  const token = await getToken();
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export async function listConversations(
  userEmail: string
): Promise<Conversation[]> {
  const hdrs = await authHeaders(userEmail);
  if (HAS_API_KEY) {
    const res = await fetch(`${V1_BASE}/conversations`, { headers: hdrs });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.conversations;
  }
  const res = await fetch(`${WEB_BASE}/conversations`, { headers: hdrs });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return data.conversations || [];
}

export async function getConversation(
  id: string,
  userEmail: string
): Promise<{ conversation: Conversation; messages: Message[] }> {
  const hdrs = await authHeaders(userEmail);
  const base = HAS_API_KEY ? V1_BASE : WEB_BASE;
  const res = await fetch(`${base}/conversations/${id}`, { headers: hdrs });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function createConversation(
  userEmail: string,
  title?: string
): Promise<Conversation> {
  const hdrs = await authHeaders(userEmail);
  const base = HAS_API_KEY ? V1_BASE : WEB_BASE;
  const res = await fetch(`${base}/conversations`, {
    method: "POST",
    headers: hdrs,
    body: JSON.stringify({ title }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return data.conversation || data;
}

export async function deleteConversation(
  id: string,
  userEmail: string
): Promise<void> {
  const hdrs = await authHeaders(userEmail);
  const base = HAS_API_KEY ? V1_BASE : WEB_BASE;
  const res = await fetch(`${base}/conversations/${id}`, {
    method: "DELETE",
    headers: hdrs,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}

export interface ChatStreamCallbacks {
  onStatus?: (stage: string, data?: any) => void;
  onDelta?: (text: string) => void;
  onSources?: (sources: { research: any[]; web: any[] }) => void;
  onSuggestions?: (prompts: string[]) => void;
  onDone?: (conversationId: string) => void;
  onError?: (error: string) => void;
}

/**
 * Parse SSE lines from a text buffer.
 * Returns the remaining (incomplete) buffer after processing.
 */
function parseSSEBuffer(
  buffer: string,
  callbacks: ChatStreamCallbacks
): string {
  const lines = buffer.split("\n");
  const remainder = lines.pop() || ""; // last line may be incomplete

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
          case "suggestions":
            callbacks.onSuggestions?.(parsed.prompts || []);
            break;
          case "done":
            callbacks.onDone?.(
              parsed.conversation_id || parsed.conversationId
            );
            break;
        }
      } catch {}
      currentEvent = "";
    }
  }
  return remainder;
}

export async function streamChat(
  query: string,
  userEmail: string,
  conversationId: string | null,
  messages: { role: string; content: string }[],
  callbacks: ChatStreamCallbacks
): Promise<void> {
  const hdrs = await authHeaders(userEmail);
  const url = HAS_API_KEY ? `${V1_BASE}/chat` : `${WEB_BASE}/chat`;
  const body = HAS_API_KEY
    ? { query, conversation_id: conversationId, messages }
    : { query, conversationId, messages };

  console.log("[ChatEQT] streamChat →", url, {
    hasApiKey: HAS_API_KEY,
    hasToken: !!(await getToken()),
  });

  return new Promise<void>((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);

    // Set headers
    for (const [key, value] of Object.entries(hdrs)) {
      xhr.setRequestHeader(key, value);
    }

    let lastIndex = 0; // track how far we've parsed in responseText
    let buffer = "";

    xhr.onprogress = () => {
      // Only process new data since last onprogress
      const newText = xhr.responseText.slice(lastIndex);
      lastIndex = xhr.responseText.length;
      buffer += newText;
      buffer = parseSSEBuffer(buffer, callbacks);
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        // Process any remaining buffer
        if (buffer) {
          parseSSEBuffer(buffer + "\n", callbacks);
        }
      } else {
        console.error(
          "[ChatEQT] streamChat HTTP error:",
          xhr.status,
          xhr.responseText.slice(0, 200)
        );
        callbacks.onError?.(
          `HTTP ${xhr.status}: ${xhr.responseText.slice(0, 100) || "Unknown error"}`
        );
      }
      resolve();
    };

    xhr.onerror = () => {
      console.error("[ChatEQT] streamChat network error");
      callbacks.onError?.("Network error — check your connection");
      resolve();
    };

    xhr.ontimeout = () => {
      console.error("[ChatEQT] streamChat timeout");
      callbacks.onError?.("Request timed out — try again");
      resolve();
    };

    xhr.timeout = 120_000; // 2 min timeout for long responses
    xhr.send(JSON.stringify(body));
  });
}
