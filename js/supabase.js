import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://qqactsebaxdottiiyrng.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_fWWIiWF4l_q-eNHU-Rs5qQ_zlaMggjo";

//EXPORT CLIENT INFO
export const supabase = createClient(
   SUPABASE_URL, SUPABASE_ANON_KEY
)


// Reactive session storage
let currentSession = null;

export async function initSession() {
  //GET SESSION
  const {
    data: { session },
  } = await supabase.auth.getSession();
  currentSession = session;
}

supabase.auth.onAuthStateChange((event, session) => {
  currentSession = session;
});

// Function other files can use
export async function getCurrentSession() {
  return currentSession;
}