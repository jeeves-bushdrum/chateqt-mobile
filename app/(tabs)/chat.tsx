import { useState, useRef, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Linking,
  AppState,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getStoredUser, AuthUser } from "../../lib/auth";
import { streamChat } from "../../lib/api";
import { registerForPushNotifications, sendLocalNotification } from "../../lib/notifications";
import { useNetwork } from "../../lib/useNetwork";
import { fetchUsage, UsageData } from "../../lib/usage";
import { getToken } from "../../lib/auth";
import { colors, spacing } from "../../lib/theme";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: { research: any[]; web: any[] };
  streaming?: boolean;
}

const ONBOARDING_PROMPTS = [
  "What are analysts saying about Fed rate cuts?",
  "Latest research on NVDA",
  "Goldman Sachs top picks for 2026",
  "Macro outlook for Europe",
  "Analyst views on Bitcoin",
  "AAPL earnings analysis",
];

function firmEmoji(firm: string): string {
  const f = (firm || "").toLowerCase();
  if (f.includes("goldman")) return "🏦";
  if (f.includes("jpmorgan") || f.includes("jp morgan")) return "🏛️";
  if (f.includes("morgan stanley")) return "📊";
  if (f.includes("bofa") || f.includes("bank of america")) return "🔵";
  if (f.includes("citi")) return "🌐";
  if (f.includes("barclays")) return "🦅";
  if (f.includes("ubs")) return "🔴";
  return "📄";
}

function SourceCard({ source }: { source: any }) {
  return (
    <TouchableOpacity
      style={styles.sourceCard}
      onPress={() => source.url && Linking.openURL(source.url)}
      disabled={!source.url}
    >
      <View style={styles.sourceHeader}>
        <Text style={styles.sourceEmoji}>
          {firmEmoji(source.source_firm)}
        </Text>
        <Text style={styles.sourceFirm} numberOfLines={1}>
          {source.source_firm || "Research"}
        </Text>
      </View>
      {source.title && (
        <Text style={styles.sourceTitle} numberOfLines={2}>
          {source.title}
        </Text>
      )}
    </TouchableOpacity>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  return (
    <View
      style={[
        styles.messageBubble,
        isUser ? styles.userBubble : styles.assistantBubble,
      ]}
    >
      <Text
        style={[
          styles.messageText,
          isUser ? styles.userText : styles.assistantText,
        ]}
      >
        {message.content}
        {message.streaming && "▍"}
      </Text>
      {message.sources && message.sources.research.length > 0 && (
        <FlatList
          horizontal
          data={message.sources.research.slice(0, 4)}
          keyExtractor={(_, i) => i.toString()}
          renderItem={({ item }) => <SourceCard source={item} />}
          style={styles.sourceList}
          showsHorizontalScrollIndicator={false}
        />
      )}
    </View>
  );
}

export default function ChatScreen() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const appStateRef = useRef(AppState.currentState);
  const isConnected = useNetwork();
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [showUpgrade, setShowUpgrade] = useState(false);

  useEffect(() => {
    getStoredUser().then((u) => {
      setUser(u);
      if (u) registerForPushNotifications();
    });
    // Fetch usage
    getToken().then((token) => {
      if (token) fetchUsage(token).then(setUsage).catch(() => {});
    });
    const sub = AppState.addEventListener("change", (state) => {
      appStateRef.current = state;
    });
    return () => sub.remove();
  }, []);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
  }, []);

  const submit = useCallback(
    async (text: string) => {
      if (!text.trim() || !user || loading) return;

      // Check free tier limit
      if (usage && usage.plan === "free" && usage.remaining <= 0) {
        setShowUpgrade(true);
        return;
      }

      const query = text.trim();
      setInput("");

      const userMsg: ChatMessage = {
        id: Date.now().toString(),
        role: "user",
        content: query,
      };
      const assistantMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "",
        streaming: true,
      };

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setLoading(true);
      setStatus("Searching research...");
      scrollToBottom();

      const history = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      await streamChat(query, user.email, conversationId, history, {
        onStatus: (stage) => {
          const labels: Record<string, string> = {
            searching_corpus: "Searching research...",
            corpus_done: "Analyzing sources...",
            generating: "Generating response...",
            web_search: "Searching the web...",
          };
          setStatus(labels[stage] || stage);
        },
        onDelta: (text) => {
          setMessages((prev) => {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            if (last.role === "assistant") {
              last.content += text;
            }
            return updated;
          });
          scrollToBottom();
        },
        onSources: (sources) => {
          setMessages((prev) => {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            if (last.role === "assistant") {
              last.sources = sources;
            }
            return updated;
          });
        },
        onDone: (convId) => {
          setMessages((prev) => {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            if (last.role === "assistant") {
              last.streaming = false;
              // Send local notification if app is backgrounded
              if (appStateRef.current !== "active") {
                sendLocalNotification(
                  "ChatEQT",
                  last.content.slice(0, 100) + (last.content.length > 100 ? "..." : "")
                );
              }
            }
            return updated;
          });
          if (convId) setConversationId(convId);
          setLoading(false);
          setStatus("");
          // Refresh usage count
          getToken().then((token) => {
            if (token) fetchUsage(token).then(setUsage).catch(() => {});
          });
        },
        onError: (error) => {
          console.error("[ChatEQT] Chat request failed:", error);
          setMessages((prev) => {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            if (last.role === "assistant") {
              last.content = __DEV__
                ? `Error: ${error}\n\nPlease try logging out and back in.`
                : "Sorry, something went wrong. Please try again.";
              last.streaming = false;
            }
            return updated;
          });
          setLoading(false);
          setStatus("");
        },
      });
    },
    [user, loading, messages, conversationId, scrollToBottom]
  );

  const isFirstTime = messages.length === 0;

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={90}
      >
        {isFirstTime ? (
          <View style={styles.onboarding}>
            <Text style={styles.onboardingIcon}>🏦</Text>
            <Text style={styles.onboardingTitle}>
              Chat<Text style={{ color: colors.blue }}>EQT</Text>
            </Text>
            <Text style={styles.onboardingSubtitle}>
              Ask anything about stocks, markets, or macro — powered by Wall
              Street research
            </Text>
            <View style={styles.promptPills}>
              {ONBOARDING_PROMPTS.map((p) => (
                <TouchableOpacity
                  key={p}
                  style={styles.promptPill}
                  onPress={() => submit(p)}
                >
                  <Text style={styles.promptPillText}>{p}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(m) => m.id}
            renderItem={({ item }) => <MessageBubble message={item} />}
            contentContainerStyle={styles.messageList}
            onContentSizeChange={scrollToBottom}
          />
        )}

        {!isConnected && (
          <View style={styles.offlineBanner}>
            <Text style={styles.offlineText}>📡 No internet connection</Text>
          </View>
        )}

        {status ? (
          <View style={styles.statusBar}>
            <ActivityIndicator size="small" color={colors.blue} />
            <Text style={styles.statusText}>{status}</Text>
          </View>
        ) : null}

        {/* Usage indicator for free users */}
        {usage && usage.plan === "free" && (
          <View style={styles.usageBar}>
            <Text style={styles.usageText}>
              {usage.remaining}/{usage.limit} queries remaining today
            </Text>
            {usage.remaining <= 1 && (
              <TouchableOpacity onPress={() => Linking.openURL("https://chateqt.com/pricing")}>
                <Text style={styles.upgradeLink}>Upgrade →</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Pro badge */}
        {usage && usage.plan === "pro" && (
          <View style={styles.proBadgeBar}>
            <Text style={styles.proBadgeText}>⚡ Pro — Unlimited queries</Text>
          </View>
        )}

        {/* Upgrade modal */}
        {showUpgrade && (
          <View style={styles.upgradeModal}>
            <Text style={styles.upgradeTitle}>Daily limit reached</Text>
            <Text style={styles.upgradeDesc}>
              You've used all 5 free queries today. Upgrade to Pro for unlimited research.
            </Text>
            <TouchableOpacity
              style={styles.upgradeBtn}
              onPress={() => {
                Linking.openURL("https://chateqt.com/pricing");
                setShowUpgrade(false);
              }}
            >
              <Text style={styles.upgradeBtnText}>⚡ Upgrade to Pro — $19/mo</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowUpgrade(false)}>
              <Text style={styles.upgradeDismiss}>Maybe later</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.inputRow}>
          <TextInput
            style={styles.textInput}
            placeholder="Ask about any stock..."
            placeholderTextColor={colors.textMuted}
            value={input}
            onChangeText={setInput}
            multiline
            maxLength={500}
            editable={!loading}
            onSubmitEditing={() => submit(input)}
            blurOnSubmit={false}
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!input.trim() || loading) && styles.sendBtnDisabled]}
            onPress={() => submit(input)}
            disabled={!input.trim() || loading || !isConnected}
          >
            <Text style={styles.sendBtnText}>↑</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  messageList: { padding: spacing.md, paddingBottom: 8 },
  messageBubble: {
    marginBottom: 12,
    maxWidth: "85%",
    borderRadius: 16,
    padding: 12,
  },
  userBubble: {
    backgroundColor: colors.blue,
    alignSelf: "flex-end",
    borderBottomRightRadius: 4,
  },
  assistantBubble: {
    backgroundColor: colors.surface,
    alignSelf: "flex-start",
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  messageText: { fontSize: 15, lineHeight: 22 },
  userText: { color: colors.text },
  assistantText: { color: colors.text },
  sourceList: { marginTop: 10 },
  sourceCard: {
    backgroundColor: colors.surfaceHover,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 10,
    marginRight: 8,
    width: 180,
  },
  sourceHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
  sourceEmoji: { fontSize: 16 },
  sourceFirm: { fontSize: 12, color: colors.textSecondary, fontWeight: "600" },
  sourceTitle: { fontSize: 12, color: colors.textMuted, lineHeight: 16 },
  statusBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  statusText: { color: colors.textMuted, fontSize: 13 },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 8,
  },
  textInput: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.text,
    maxHeight: 120,
  },
  sendBtn: {
    backgroundColor: colors.blue,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnDisabled: { opacity: 0.4 },
  sendBtnText: { color: colors.text, fontSize: 18, fontWeight: "700" },
  offlineBanner: {
    backgroundColor: "#7c2d12",
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    alignItems: "center",
  },
  offlineText: { color: "#fdba74", fontSize: 13, fontWeight: "500" },
  usageBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  usageText: { color: colors.textMuted, fontSize: 12 },
  upgradeLink: { color: colors.blue, fontSize: 12, fontWeight: "600" },
  proBadgeBar: {
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    alignItems: "center",
  },
  proBadgeText: { color: colors.blueLight, fontSize: 11, fontWeight: "600" },
  upgradeModal: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    alignItems: "center",
  },
  upgradeTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "700",
    marginBottom: spacing.sm,
  },
  upgradeDesc: {
    color: colors.textSecondary,
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  upgradeBtn: {
    backgroundColor: colors.blue,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
    width: "100%",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  upgradeBtnText: { color: colors.text, fontSize: 16, fontWeight: "600" },
  upgradeDismiss: { color: colors.textMuted, fontSize: 14 },
  onboarding: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
  },
  onboardingIcon: { fontSize: 48, marginBottom: spacing.md },
  onboardingTitle: {
    fontSize: 32,
    fontWeight: "800",
    color: colors.text,
    marginBottom: spacing.sm,
  },
  onboardingSubtitle: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: spacing.lg,
  },
  promptPills: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
  },
  promptPill: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  promptPillText: { color: colors.textSecondary, fontSize: 13 },
});
