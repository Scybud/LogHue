import { sessionState, sessionReady } from "../session.js";
import {supabase} from "https://loghue.com/supabase.js"
async function protectLoginPage() {
  await sessionReady;

  if (sessionState.user) {
    window.location.href = "https://app.loghue.com";
    return;
  }

  // optional: listen once for OAuth redirect
  supabase.auth.onAuthStateChange((_event, session) => {
    if (session) {
      window.location.href = "https://app.loghue.com";
    }
  });
}

protectLoginPage();
