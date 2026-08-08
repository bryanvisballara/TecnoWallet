import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

export type OfflineMutation = {
  id: string;
  idempotencyKey: string;
  endpoint: string;
  method: 'POST' | 'PATCH' | 'DELETE';
  payload?: unknown;
  baseVersion?: number;
  createdAt: number;
  attempts: number;
};

const TOKEN_KEY = 'tecnowallet.auth-token';
const QUEUE_KEY = 'tecnowallet.offline-queue';
const isWeb = Platform.OS === 'web';

export const tokenStorage = {
  async get() {
    if (isWeb) return AsyncStorage.getItem(TOKEN_KEY);
    return SecureStore.getItemAsync(TOKEN_KEY);
  },
  async set(token: string) {
    if (isWeb) return AsyncStorage.setItem(TOKEN_KEY, token);
    return SecureStore.setItemAsync(TOKEN_KEY, token, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  },
  async clear() {
    if (isWeb) return AsyncStorage.removeItem(TOKEN_KEY);
    return SecureStore.deleteItemAsync(TOKEN_KEY);
  },
};

export const localStorage = {
  async get<T>(key: string, fallback: T): Promise<T> {
    try {
      const value = await AsyncStorage.getItem(`tecnowallet.${key}`);
      return value ? JSON.parse(value) as T : fallback;
    } catch {
      return fallback;
    }
  },
  set<T>(key: string, value: T) {
    return AsyncStorage.setItem(`tecnowallet.${key}`, JSON.stringify(value));
  },
  remove(key: string) {
    return AsyncStorage.removeItem(`tecnowallet.${key}`);
  },
};

export const offlineQueue = {
  list: () => localStorage.get<OfflineMutation[]>(QUEUE_KEY, []),
  async enqueue(
    mutation: Omit<OfflineMutation, 'id' | 'idempotencyKey' | 'createdAt' | 'attempts'> & {
      idempotencyKey?: string;
    },
  ) {
    const queue = await this.list();
    const id = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const item: OfflineMutation = {
      ...mutation,
      id,
      idempotencyKey: mutation.idempotencyKey ?? id,
      createdAt: Date.now(),
      attempts: 0,
    };
    await localStorage.set(QUEUE_KEY, [...queue, item]);
    return item;
  },
  replace: (queue: OfflineMutation[]) => localStorage.set(QUEUE_KEY, queue),
  clear: () => localStorage.remove(QUEUE_KEY),
};
