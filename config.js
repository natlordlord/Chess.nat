/* Chess.nat settings. Fill in the two Supabase values (Project Settings → API in Supabase).
   The anon key is meant to be public: access is protected by row level security (see supabase/schema.sql). */
window.CHESSNAT_CONFIG = {
  supabaseUrl: "https://YOUR-PROJECT.supabase.co",
  supabaseAnonKey: "YOUR-ANON-KEY",
  google: false
};
