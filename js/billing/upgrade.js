import { supabase } from "../../js/supabase.js";
import { actionMsg } from "../utils/modals.js";

let loading = false;

async function startUpgrade() {
  if (loading) return;
  loading = true;

  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      window.location.href = "/auth?redirect=/billing";
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const planId = params.get("plan");

    if (!planId) {
      actionMsg("Missing plan ID.", "error");
      loading = false;
      return;
    }

    const { data, error } = await supabase.functions.invoke("create-checkout", {
      body: { id: planId },
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    });

    if (error) {
      console.error(error);
      actionMsg("Failed to start checkout.", "error");
      loading = false;
      return;
    }

    // -----------------------------
    // CASE 1: Stripe checkout
    // -----------------------------
    if (data?.url) {
      window.location.href = data.url;
      return;
    }

    // -----------------------------
    // CASE 2: instant update (addon/plan modify)
    // -----------------------------
    if (data?.success) {
      actionMsg(data.message || "Updated successfully!", "success");

      // optional redirect
      setTimeout(() => {
        window.location.href = "/billing";
      }, 800);

      return;
    }

    console.error("Unexpected response:", data);
    actionMsg("Unexpected server response.", "error");
  } finally {
    loading = false;
  }
}

startUpgrade();
