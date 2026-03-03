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

// Detect session after redirect
supabase.auth.getSession().then(({ data: { session } }) => {
  if (session) {
    console.log("Logged in:", session.user);
    window.location.href = "dashboard.html"
    // update UI here
  }
});