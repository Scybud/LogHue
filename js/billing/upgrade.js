import { supabase } from "../../js/supabase.js";
import { actionMsg } from "../utils/modals.js";

let loading = false;
const msg = document.querySelector(".msg");

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
      msg.textContent = "Missing plan ID. Redirecting...";
      msg.classList.add("error");

      loading = false;

      // redirect
      setTimeout(() => {
        window.location.href = "/billing";
      }, 1000);
      return;
    }

    const { data, error } = await supabase.functions.invoke("create-checkout", {
      body: { id: planId },
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    });

    if (error?.message.includes("Already purchased")) {
      actionMsg("You already have this plan", "info");
      msg.textContent = "You already have this plan";
      msg.classList.add("warning");

      // redirect
      setTimeout(() => {
        window.location.href = "/billing";
      }, 1000);
      return;
    }

    if (error) {
      console.error(error);
      actionMsg("Failed to start checkout.", "error");
      msg.textContent = "Failed to start checkout. Redirecting...";
      msg.classList.add("error");
      loading = false;

      // redirect
      setTimeout(() => {
        window.location.href = "/billing";
      }, 1000);
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
      msg.textContent = "Updated successfully!";
      msg.classList.add("success");

      // redirect
      setTimeout(() => {
        window.location.href = "/billing";
      }, 1000);

      return;
    }

    console.error("Unexpected response:", data);
    actionMsg("Unexpected server response.", "error");
    msg.textContent = "Unexpected server response. Redirecting...";
    msg.classList.add("error");

    // redirect
    setTimeout(() => {
      window.location.href = "/billing";
    }, 1000);

  } finally {
    loading = false;
  }
}

startUpgrade();
