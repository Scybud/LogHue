import { supabase } from "../../js/supabase.js";
import { actionMsg } from "../utils/modals.js";

let loading = false;
async function startUpgrade() {
  if (loading) return;
  loading = true;
  //  Ensure user is logged in 
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    window.location.href = "/auth?redirect=/billing";
    return;
  }

  //  Extract plan ID from URL 
  const params = new URLSearchParams(window.location.search);
  const planId = params.get("plan");

  if (!planId) {
    actionMsg("Missing plan ID.", "error");
    return;
  }

  //  Extract access token safely 
  const accessToken = session.access_token;
  if (!accessToken) {
    window.location.href = "/auth?redirect=/billing";
    return;
  }

  //  Call Edge Function (I turned off JWT) 
const { data, error } = await supabase.functions.invoke("create-checkout", {
  body: {
    id: planId,
  },
  headers: {
    Authorization: `Bearer ${session.access_token}`,
  },
});

  if (error) {
    console.error(error);
    actionMsg("Failed to start checkout.", "error");
    return;
  }

  //  Redirect to Stripe Checkout 
  if (data?.url) {
    window.location.href = data.url;
  } else {
    console.error("No URL returned:", data);
    actionMsg("Checkout session failed.", "error");
  }
}

startUpgrade();
