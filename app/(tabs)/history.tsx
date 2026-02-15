import { useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { getStoredUser, AuthUser } from "../../lib/auth";
import {
  listConversations,
  deleteConversation,
  Conversation,
} from "../../lib/api";
import { cacheConversations, getCachedConversations } from "../../lib/cache";
import { useNetwork } from "../../lib/useNetwork";
import { colors, spacing } from "../../lib/theme";

export default function HistoryScreen() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [offline, setOffline] = useState(false);
  const isConnected = useNetwork();

  const load = useCallback(async (isRefresh = false) => {
    const u = await getStoredUser();
    setUser(u);
    if (!u) {
      setLoading(false);
      return;
    }

    try {
      const convos = await listConversations(u.email);
      setConversations(convos);
      await cacheConversations(convos);
      setOffline(false);
    } catch {
      // Offline — load from cache
      const cached = await getCachedConversations();
      setConversations(cached);
      setOffline(true);
    }
    setLoading(false);
    if (isRefresh) setRefreshing(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load(true);
  }, [load]);

  const handleDelete = (conv: Conversation) => {
    if (!isConnected) {
      Alert.alert("Offline", "Can't delete conversations while offline");
      return;
    }
    Alert.alert("Delete Conversation", `Delete "${conv.title}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          if (!user) return;
          try {
            await deleteConversation(conv.id, user.email);
            const updated = conversations.filter((c) => c.id !== conv.id);
            setConversations(updated);
            await cacheConversations(updated);
          } catch {}
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.blue} />
      </View>
    );
  }

  if (conversations.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyIcon}>📋</Text>
        <Text style={styles.emptyTitle}>No conversations yet</Text>
        <Text style={styles.emptySubtitle}>
          Start chatting to see your history here
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.wrapper}>
      {offline && (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineText}>📡 Showing cached conversations</Text>
        </View>
      )}
      <FlatList
        data={conversations}
        keyExtractor={(c) => c.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.blue}
            colors={[colors.blue]}
          />
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onLongPress={() => handleDelete(item)}
          >
            <Text style={styles.cardTitle} numberOfLines={1}>
              {item.title}
            </Text>
            <Text style={styles.cardDate}>
              {new Date(item.updated_at).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: colors.bg },
  center: {
    flex: 1,
    backgroundColor: colors.bg,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
  },
  list: { padding: spacing.md },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.text,
    marginBottom: 4,
  },
  cardDate: {
    fontSize: 12,
    color: colors.textMuted,
  },
  emptyIcon: { fontSize: 48, marginBottom: spacing.md },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.text,
    marginBottom: spacing.sm,
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: "center",
  },
  offlineBanner: {
    backgroundColor: "#7c2d12",
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    alignItems: "center",
  },
  offlineText: { color: "#fdba74", fontSize: 13, fontWeight: "500" },
});
