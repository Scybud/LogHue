import { supabase } from "../supabase.js";

async function handleAuth() {
  const { data } = await supabase.auth.getSession();

  if (!data.session) {
    window.location.href = "/auth";
    return;
  }

  const redirectTo = localStorage.getItem("post_login_redirect");

  if (redirectTo) {
    localStorage.removeItem("post_login_redirect");
    window.location.href = redirectTo;
  } else {
    window.location.href = "/";
  }
}

handleAuth();
