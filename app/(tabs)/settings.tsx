import { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Linking,
} from "react-native";
import { useRouter } from "expo-router";
import { getStoredUser, clearAuth, AuthUser } from "../../lib/auth";
import { colors, spacing } from "../../lib/theme";

export default function SettingsScreen() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    getStoredUser().then(setUser);
  }, []);

  const handleLogout = () => {
    Alert.alert("Log Out", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log Out",
        style: "destructive",
        onPress: async () => {
          await clearAuth();
          router.replace("/");
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      {/* User info */}
      <View style={styles.section}>
        <View style={styles.userCard}>
          <Text style={styles.avatar}>👤</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.userName}>{user?.name || user?.email || "..."}</Text>
            {user?.name && <Text style={styles.userEmail}>{user.email}</Text>}
          </View>
          <View
            style={[
              styles.planBadge,
              user?.plan === "pro" && styles.planBadgePro,
            ]}
          >
            <Text style={styles.planText}>
              {user?.plan === "pro" ? "PRO" : "FREE"}
            </Text>
          </View>
        </View>
      </View>

      {/* Upgrade CTA */}
      {user?.plan !== "pro" && (
        <TouchableOpacity
          style={styles.upgradeBtn}
          onPress={() => Linking.openURL("https://chateqt.com/pricing")}
        >
          <Text style={styles.upgradeBtnText}>⚡ Upgrade to Pro</Text>
          <Text style={styles.upgradeSubtext}>
            Unlimited research queries
          </Text>
        </TouchableOpacity>
      )}

      {/* Links */}
      <View style={styles.section}>
        <TouchableOpacity
          style={styles.row}
          onPress={() => Linking.openURL("https://chateqt.com/privacy")}
        >
          <Text style={styles.rowText}>Privacy Policy</Text>
          <Text style={styles.rowArrow}>→</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.row}
          onPress={() => Linking.openURL("https://chateqt.com/terms")}
        >
          <Text style={styles.rowText}>Terms of Service</Text>
          <Text style={styles.rowArrow}>→</Text>
        </TouchableOpacity>
      </View>

      {/* Logout */}
      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Text style={styles.logoutText}>Log Out</Text>
      </TouchableOpacity>

      <Text style={styles.version}>ChatEQT v1.0.0</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    padding: spacing.md,
  },
  section: {
    marginBottom: spacing.lg,
  },
  userCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: 12,
  },
  avatar: { fontSize: 32 },
  userName: { fontSize: 16, fontWeight: "600", color: colors.text },
  userEmail: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  planBadge: {
    backgroundColor: colors.border,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  planBadgePro: {
    backgroundColor: colors.blueDark,
  },
  planText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.text,
  },
  upgradeBtn: {
    backgroundColor: colors.blueDark,
    borderRadius: 12,
    padding: spacing.md,
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  upgradeBtnText: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "700",
  },
  upgradeSubtext: {
    color: colors.blueLight,
    fontSize: 13,
    marginTop: 4,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: 8,
  },
  rowText: { fontSize: 15, color: colors.text },
  rowArrow: { fontSize: 16, color: colors.textMuted },
  logoutBtn: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.red,
    padding: spacing.md,
    alignItems: "center",
    marginTop: spacing.md,
  },
  logoutText: { color: colors.red, fontSize: 16, fontWeight: "600" },
  version: {
    color: colors.textMuted,
    fontSize: 12,
    textAlign: "center",
    marginTop: spacing.lg,
  },
});
