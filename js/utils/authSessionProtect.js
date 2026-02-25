import { supabase } from "../supabase.js";

async function protectPage() {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    window.location.href = "dashboard.html";
  }
}
protectPage();
