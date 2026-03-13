import { sessionState, sessionReady } from "../session.js";
import {supabase} from "https://loghue.com/js/supabase.js"
async function protectLoginPage() {
  await sessionReady;

  setTimeout(() => {

    if (sessionState.user) {
      window.location.href = "https://app.loghue.com";
      return;
    }
  }, 1000)

  // optional: listen once for OAuth redirect
  supabase.auth.onAuthStateChange((_event, session) => {
    if (session) {
      window.location.href = "https://app.loghue.com";
    }
  });
}

protectLoginPage();
