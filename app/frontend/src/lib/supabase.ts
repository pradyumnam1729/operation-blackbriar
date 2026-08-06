import { createClient } from "@supabase/supabase-js";

// Publishable key: public by design (RLS protects data; all writes go through
// the backend with the service role). Override via Vite env if needed.
const url =
  (import.meta.env.VITE_SUPABASE_URL as string | undefined) ??
  "https://vutpzostobbwykijanas.supabase.co";
const publishableKey =
  (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ??
  "sb_publishable_ULLo3ajNCEAnSd2dNL1v_g_04SIosVv";

export const supabase = createClient(url, publishableKey);
