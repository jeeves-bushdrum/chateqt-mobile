import AsyncStorage from "@react-native-async-storage/async-storage";
import { Conversation } from "./api";

const CONVERSATIONS_KEY = "chateqt_cached_conversations";
const MESSAGES_PREFIX = "chateqt_cached_messages_";

export async function cacheConversations(
  conversations: Conversation[]
): Promise<void> {
  try {
    await AsyncStorage.setItem(
      CONVERSATIONS_KEY,
      JSON.stringify(conversations)
    );
  } catch {}
}

export async function getCachedConversations(): Promise<Conversation[]> {
  try {
    const raw = await AsyncStorage.getItem(CONVERSATIONS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function cacheMessages(
  conversationId: string,
  messages: any[]
): Promise<void> {
  try {
    await AsyncStorage.setItem(
      MESSAGES_PREFIX + conversationId,
      JSON.stringify(messages)
    );
  } catch {}
}

export async function getCachedMessages(
  conversationId: string
): Promise<any[]> {
  try {
    const raw = await AsyncStorage.getItem(MESSAGES_PREFIX + conversationId);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function clearCache(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const cacheKeys = keys.filter(
      (k) =>
        k.startsWith("chateqt_cached_") || k.startsWith(MESSAGES_PREFIX)
    );
    await AsyncStorage.multiRemove(cacheKeys);
  } catch {}
}
