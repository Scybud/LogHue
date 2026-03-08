import { supabase } from "./supabase.js";

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
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    console.error(error);
    await supabase.auth.signOut();
    resolveSessionReady(); // still resolve to avoid blocking
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
      "https://scyflix.github.io/LogHue/assets/images/default_profile.png";
  }

  // PLAN
  if (subscriptionType && sessionState.plan) {
    subscriptionType.textContent = sessionState.plan.name;
  }
}
