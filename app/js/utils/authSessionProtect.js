import { sessionState, sessionReady } from "../session.js";
import { supabase } from "../supabase.js";

async function protectLoginPage() {
  await sessionReady;

  if (sessionState.user) {
    window.location.href = "./";
    return;
  }

  // listen once for OAuth redirect

  supabase.auth.onAuthStateChange((_event, session) => {
    if (session) {
      window.location.href = "./";
    }
  });
}
protectLoginPage();
