import { supabase } from "../js/supabase.js"; 

export default async function handler(req, res) {
  // Set cookie for all subdomains
  await supabase.auth.api.setAuthCookie(req, res, { domain: ".loghue.com" });

  // Redirect user to app dashboard
  res.redirect("https://app.loghue.com");
}
