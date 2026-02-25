import { getCurrentSession, initSession } from "./../supabase.js";

await initSession();

//REDIRECT IF USER LOGGED IN
const session = getCurrentSession();
if (session) {
  window.location.href = "dashboard.html";
}
