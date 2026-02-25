import { initSession, getCurrentSession } from "../supabase.js";

//If session exists, redirect to landing page
await initSession();

const session = getCurrentSession();

if (!session) {
  window.location.href = "auth.html";
}
