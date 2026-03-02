import { supabase } from "../supabase.js";

async function protectPage() {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

if (error || !user) {
    window.location.href = "https://scyflix.github.io/LogHue/pages/auth.html";
  }
  return user;
}
protectPage()
