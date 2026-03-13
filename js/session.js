import { supabase } from "./supabase.js";

const hash = window.location.hash;

if (hash.includes("session=")) {
  const session = JSON.parse(decodeURIComponent(hash.replace("#session=", "")));
  await supabase.auth.setSession(session);
  window.location.hash = ""; // clean up URL
}

export const sessionState = {
  user: null,
  profile: null,
  plan: null,
};

// Promise that resolves when session is fully loaded
let resolveSessionReady;
export const sessionReady = new Promise((resolve) => {
  resolveSessionReady = resolve;
});

export async function initSession() {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  const user = session?.user || null;

  if (error) {
    console.error(error);
    resolveSessionReady(); // resolve to avoid blocking
    return;
  }

  if (!user) {
    console.warn("No active session");
    resolveSessionReady();
    return;
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*, plan (id, name, max_workspaces, max_members, price)")
    .eq("id", user.id)
    .single();

  if (profileError) {
    console.error(profileError);
    resolveSessionReady();
    return;
  }

  sessionState.user = user;
  sessionState.profile = profile;
  sessionState.plan = profile.plan;

  resolveSessionReady(); // session is now ready

  userInfoUi();
}

function userInfoUi() {
  const profileImg = document.querySelector(".profileImg");
  const userName = document.getElementById("userName");
  const subscriptionType = document.getElementById("subscriptionType");

  if (!sessionState.user || !sessionState.profile) return;

  const email = sessionState.user.email;
  const [local, domain] = email.split("@");
  const shortEmail = `${local.slice(0, 9)}...@${domain}`;

  // NAME
  if (userName) {
    if (sessionState.profile.full_name === "User") {
      userName.textContent = shortEmail;
    } else {
      userName.textContent = sessionState.profile.full_name;
    }
  }

  // AVATAR
  if (profileImg) {
    profileImg.src =
      sessionState.profile.avatar_url ||
      "https://loghue.com/assets/images/default_profile.png";
  }

  // PLAN
  if (subscriptionType && sessionState.plan) {
    subscriptionType.textContent = sessionState.plan.name;
  }
}
