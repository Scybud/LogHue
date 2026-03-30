import { sessionState, sessionReady } from "../../js/session.js";
import { supabase } from "../../js/supabase.js";
import { actionMsg } from "../utils/modals.js";


async function startUpgrade() {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return (window.location.href = "/login");
  }

  const params = new URLSearchParams(window.location.search);
  const planId = params.get("plan");

  if (!planId) {
    actionMsg("Missing plan ID.", "error");

    /*
      setTimeout(() => {
         window.location.href = "/billing";
      }, 2000)
      */

    return;
  }

  // get current session (access token)
  const accessToken = session?.access_token;

  if (!accessToken) {
    // not authenticated
    return (window.location.href = "/login?redirect=/billing");
  }

  
   const { data, error } = await supabase.functions.invoke("create-checkout", {
     body: { planId, userId: session.user.id },

   });

if (error) {
  console.error(error);
  actionMsg("Failed to start checkout.", "error");
  return;
}

   if (data?.url) {
     window.location.href = data.url;
   } else {
     console.error("No URL returned:", data);
     actionMsg("Checkout session failed.", "error");
   }
} 
startUpgrade();