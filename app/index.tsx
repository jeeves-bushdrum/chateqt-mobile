import { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { getStoredUser } from "../lib/auth";
import { colors, spacing } from "../lib/theme";

export default function LandingScreen() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    getStoredUser().then((user) => {
      if (user) {
        router.replace("/(tabs)/chat");
      } else {
        setChecking(false);
      }
    });
  }, []);

  if (checking) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={colors.blue} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.hero}>
        <Text style={styles.icon}>🏦</Text>
        <Text style={styles.logo}>
          Chat<Text style={styles.logoAccent}>EQT</Text>
        </Text>
        <Text style={styles.tagline}>
          AI-Powered Wall Street Research
        </Text>
        <Text style={styles.subtitle}>
          Get instant answers from Goldman Sachs, JPMorgan, Morgan Stanley, and more
        </Text>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={() => router.push("/signup")}
        >
          <Text style={styles.primaryBtnText}>Sign Up Free</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryBtn}
          onPress={() => router.push("/login")}
        >
          <Text style={styles.secondaryBtnText}>Log In</Text>
        </TouchableOpacity>

        <Text style={styles.free}>
          5 free queries per day · No credit card required
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  hero: {
    alignItems: "center",
    marginBottom: 48,
  },
  icon: {
    fontSize: 56,
    marginBottom: spacing.md,
  },
  logo: {
    fontSize: 42,
    fontWeight: "800",
    color: colors.text,
    marginBottom: spacing.sm,
  },
  logoAccent: {
    color: colors.blue,
  },
  tagline: {
    fontSize: 18,
    color: colors.textSecondary,
    textAlign: "center",
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: "center",
    lineHeight: 20,
    paddingHorizontal: spacing.md,
  },
  actions: {
    alignItems: "center",
    gap: 12,
  },
  primaryBtn: {
    backgroundColor: colors.blue,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
    width: "100%",
    alignItems: "center",
  },
  primaryBtnText: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "600",
  },
  secondaryBtn: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 14,
    paddingHorizontal: 32,
    width: "100%",
    alignItems: "center",
  },
  secondaryBtnText: {
    color: colors.textSecondary,
    fontSize: 17,
    fontWeight: "600",
  },
  free: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: spacing.sm,
  },
});
