import { createClient } from "https://esm.sh/@supabase/supabase-js@2.111.0";

const SUPABASE_URL = "https://qqactsebaxdottiiyrng.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_fWWIiWF4l_q-eNHU-Rs5qQ_zlaMggjo";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});
