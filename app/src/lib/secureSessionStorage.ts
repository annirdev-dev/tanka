import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createSecureSessionStorage } from "./secureSessionStorage.core";

// Storage handed to the Supabase client for the login session. Available after
// the first unlock so the session can still refresh if the app is woken while
// the phone is locked.
export const secureSessionStorage = createSecureSessionStorage(
  {
    getItemAsync: (key) => SecureStore.getItemAsync(key),
    setItemAsync: (key, value) =>
      SecureStore.setItemAsync(key, value, { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK }),
    deleteItemAsync: (key) => SecureStore.deleteItemAsync(key),
  },
  AsyncStorage
);
