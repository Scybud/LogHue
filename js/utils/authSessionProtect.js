import { supabase } from "../supabase.js";

// LOGIN PAGE PROTECTION
// If the user is already logged in, send them to dashboard.
// Otherwise, stay on the login page.

async function protectPage() {
  // Check if a session already exists
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (session) {
    window.location.href = "https://app.loghue.com";
    return;
  }

  // Wait for Supabase to restore the session after OAuth redirect
  supabase.auth.onAuthStateChange((_event, session) => {
    if (session) {
      window.location.href = "https://app.loghue.com";
    }
  });
}

protectPage();
