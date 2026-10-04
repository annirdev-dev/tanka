import "react-native-url-polyfill/auto";
import { createClient } from "@supabase/supabase-js";
import { secureSessionStorage } from "./secureSessionStorage";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    // Keychain/Keystore, not plain app storage (see secureSessionStorage.ts).
    storage: secureSessionStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
