import { supabase } from "./supabase.js";

export const sessionState = {
  user: null,
  profile: null,
  plan: null,
};

export async function initSession() {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    console.error(error);
    return;
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*, plan (id, name, max_workspaces, max_members, price)")
    .eq("id", user.id)
    .single();

  if (profileError) {
    console.error(profileError);
    return;
  }

  sessionState.user = user;
  sessionState.profile = profile;
  sessionState.plan = profile.plan;

  userInfoUi();
}

function userInfoUi() {
  const profileImg = document.querySelector(".profileImg");
  const userName = document.getElementById("userName");
  const subscriptionType = document.getElementById("subscriptionType");

  if (!sessionState.user || !sessionState.profile) return;

  // NAME
  if (userName) {
    if (sessionState.profile.full_name === "User") {
      userName.textContent = sessionState.user.email;
    } else {
      userName.textContent = sessionState.profile.full_name;
    }
  }

  // AVATAR
  if (profileImg) {
    if (sessionState.profile.avatar_url) {
      profileImg.src = `https://scyflix.github.io/LogHue${sessionState.profile.avatar_url}`;
    } else {
      profileImg.src =
        "https://scyflix.github.io/LogHue/assets/images/default_profile.png";
    }
  }

  // PLAN
  if (subscriptionType && sessionState.plan) {
    subscriptionType.textContent = sessionState.plan.name;
  }
}
