import { supabase } from "../supabase.js";

async function protectPage() {
  /*
  supabase.auth.onAuthStateChange((event, session) => {
    if (!session) {
      window.location.href = "https://scyflix.github.io/LogHue/pages/auth.html";
    }
  });
*/

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    // Wait a moment for the cookie to load
    setTimeout(async () => {
      const {
        data: { session: newSession },
      } = await supabase.auth.getSession();
      if (!newSession) {
        window.location.href =
          "https://scyflix.github.io/LogHue/pages/auth.html";
      }
    }, 300);
  }
}

protectPage();
