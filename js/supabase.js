import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://qqactsebaxdottiiyrng.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_fWWIiWF4l_q-eNHU-Rs5qQ_zlaMggjo";

//EXPORT CLIENT INFO
export const supabase = createClient(
   SUPABASE_URL,
   SUPABASE_ANON_KEY
)
