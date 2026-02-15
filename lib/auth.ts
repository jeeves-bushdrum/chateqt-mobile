import * as SecureStore from "expo-secure-store";

const TOKEN_KEY = "chateqt_token";
const USER_KEY = "chateqt_user";

export interface AuthUser {
  id: string;
  email: string;
  name?: string;
  plan: string;
}

export async function getStoredUser(): Promise<AuthUser | null> {
  try {
    const raw = await SecureStore.getItemAsync(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function storeUser(user: AuthUser): Promise<void> {
  await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
}

export async function getToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function storeToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function clearAuth(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
  await SecureStore.deleteItemAsync(USER_KEY);
}

const API_BASE = "https://chateqt.com";

export async function login(
  email: string,
  password: string
): Promise<AuthUser> {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Login failed");
  }
  const data = await res.json();
  // Extract token from set-cookie
  const setCookie = res.headers.get("set-cookie") || "";
  const tokenMatch = setCookie.match(/chateqt_token=([^;]+)/);
  if (tokenMatch) await storeToken(tokenMatch[1]);
  const user: AuthUser = data.user;
  await storeUser(user);
  return user;
}

export async function signup(
  email: string,
  password: string,
  name?: string
): Promise<AuthUser> {
  const res = await fetch(`${API_BASE}/api/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, name }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Signup failed");
  }
  const data = await res.json();
  const setCookie = res.headers.get("set-cookie") || "";
  const tokenMatch = setCookie.match(/chateqt_token=([^;]+)/);
  if (tokenMatch) await storeToken(tokenMatch[1]);
  const user: AuthUser = data.user;
  await storeUser(user);
  return user;
}
