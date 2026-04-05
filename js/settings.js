import { sessionState } from "./session.js";
import { supabase } from "./supabase.js";
import {actionMsg, confirmAction} from "./utils/modals.js"
import { registerPush, PUBLIC_VAPID_KEY } from "./push.js";

async function initUserSettingsData() {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    console.error(error);
    alert(error.message + "." + " " + "Redirecting to login");
    window.location.href = "../auth";
    return;
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (profileError) {
    console.error(profileError);
    return;
  }

  sessionState.user = user;
  sessionState.profile = profile;

  sessionState.originalName = profile.full_name;
  sessionState.originalEmail = user.email;
  sessionState.originalAvatar = profile.avatar_url;

  loadData();
}
function loadData() {
  const accNameEl = document.getElementById("accName");
  const accEmailEl = document.getElementById("accEmail");
  const settingsAvatarEl = document.querySelector(".settingsAvatar");

  if (accNameEl) {
    accNameEl.value = sessionState.profile.full_name;
  }
  if (accEmailEl) {
    accEmailEl.value = sessionState.user.email;
  }

  if (settingsAvatarEl && sessionState.profile.avatar_url) {
    settingsAvatarEl.src = sessionState.profile.avatar_url;
  }

  //Notification preference
    const checkbox = document.getElementById("enablePush");
    checkbox.checked = sessionState.profile.push_enabled;

    saveNotifPreference(sessionState.profile)
}

initUserSettingsData();

//PROFILE PHOTO UPLOAD
const profilePhotoInput = document.getElementById("profilePhotoInput");
const profileUploadBtn = document.getElementById("profileUploadBtn");
const settingsAvatar = document.querySelector(".settingsAvatar");

//TRIGGER IMAGE INPUT FIELD
profileUploadBtn.addEventListener("click", () => {
  profilePhotoInput.click();
});

let pendingAvatarProfile = null;

const MAX_SIZE = 20 * 1024; // 20 KB limit

profilePhotoInput.addEventListener("change", () => {
  const file = profilePhotoInput.files[0];
  if (!file) return;

  const img = new Image();
  img.src = URL.createObjectURL(file);

  img.onload = () => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    // Keep original dimensions (or resize if you want)
    canvas.width = img.width;
    canvas.height = img.height;

    ctx.drawImage(img, 0, 0);

    // Convert to WebP (quality 0.7 is usually perfect)
    canvas.toBlob(
      (blob) => {
        if (!blob) return;

        if (blob.size > MAX_SIZE) {
          alert("Image must be smaller than 20 KB after compression.");
          profilePhotoInput.value = "";
          return;
        }

        // Replace the original file with the WebP blob
        pendingAvatarProfile = new File([blob], "avatar.webp", {
          type: "image/webp",
        });

        // Update preview
        settingsAvatar.src = URL.createObjectURL(blob);
      },
      "image/webp",
      0.7,
    );
  };
});

//SAVE SETTINGS CHANGES
const user = sessionState.user;
const saveBtn = document.querySelector(".settingsSaveBtn");

saveBtn.addEventListener("click", async () => {
  

  const updates = {};

  const newName = document.getElementById("accName").value;
  const newEmail = document.getElementById("accEmail").value;

  //EMPTY FIELD?
  if (newName === "" || newEmail === "") {
   
    actionMsg("All fields must be filled", "error");
    return;
  }

  //NAME CHANGED?
  if (newName != sessionState.originalName) {
    updates.full_name = newName;
  }

  //EMAIL CHANGED?
  if (newEmail != sessionState.originalEmail) {
    const {data, error} = await supabase.auth.updateUser({
      email: newEmail,
    });

    if(error) {
      actionMsg(error.message);
      console.log({ error });
      return ;
    }

actionMsg("Check your email inbox to confirm the new email", "success");  
}

  //AVATAR CHANGED?
  if (pendingAvatarProfile) {
    const filePath = `${sessionState.user.id}-${Date.now()}.webp`;

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(filePath, pendingAvatarProfile, { upsert: true });

    if (uploadError) {
         

      console.error(uploadError);
      return;
    }

    const { data: urlData } = supabase.storage
      .from("avatars")
      .getPublicUrl(filePath);

    updates.avatar_url = urlData.publicUrl;
  }

  // Save only changed fields
  if (Object.keys(updates).length > 0) {
    const { error } = await supabase
      .from("profiles")
      .update(updates)
      .eq("id", sessionState.user.id);

    if (error) {
         
      console.error(error);
      return;
    }

    actionMsg("Changes saved!", "success");
       
  }

  pendingAvatarProfile = null;
  });
  
  
//Notifications
function saveNotifPreference(user) {

  const enablePush = document.getElementById("enablePush");
  enablePush.addEventListener("change", async (e) => {
  const enabled = e.target.checked;

  //save preference
  await supabase.from("profiles").update({push_enabled: enabled}).eq("id", user.id);
  if (enabled) {
    await enablePushNotifications();
    actionMsg("Push notification enabled", "success")
  } else {
    await disablePushNotifications();
        actionMsg("Push notification disabled", "success");
  }
})
}

async function enablePushNotifications() {
  const subscription = await registerPush();

  if (subscription.error) {
    actionMsg(subscription.error, "error");
    return;
  }

  // Save subscription in Supabase
  await supabase.from("push_subscriptions").insert({
    user_id: sessionState.user.id,
    endpoint: subscription.endpoint,
    p256dh: subscription.keys.p256dh,
    auth: subscription.keys.auth,
  });

  actionMsg("Push notifications enabled", "success");
}

async function disablePushNotifications() {
  const registration = await navigator.serviceWorker.getRegistration();
  if (!registration) return;

  const subscription = await registration.pushManager.getSubscription();
  if (subscription) {
    await subscription.unsubscribe();

    await supabase
      .from("push_subscriptions")
      .delete()
      .eq("user_id", sessionState.user.id);
  }

  actionMsg("Push notifications disabled", "success");
}



//ACCOUNT DELETION
export async function requestAccountDeletion() {
  const deleteAccountBtn = document.getElementById("deleteAccount");
  if (!deleteAccountBtn) return;

  deleteAccountBtn.addEventListener("click", async () => {
    if (deleteAccountBtn.disabled) return;
    deleteAccountBtn.disabled = true;

     confirmAction(
       "We will send you an email with a confirmation link. Continue?",
       [
         { label: "Cancel", type: "cancel" },
         {
           label: "Continue",
           type: "confirm",
           onClick: () =>
             performAccountDeletionProcess(),
         },
       ],
     );

    deleteAccountBtn.disabled = false;
  });
}

requestAccountDeletion();

async function performAccountDeletionProcess() {
  const deleteAccountBtn = document.getElementById("deleteAccount");
  if (!deleteAccountBtn) return;

  // Prevent double clicks
  if (deleteAccountBtn.disabled) return;

  // 1. Confirm FIRST — nothing happens unless user agrees
  const confirmAction = confirm(
    "Are you sure you want to delete this account? We will send you a confirmation link by email.",
  );

  if (!confirmAction) {
    // User cancelled → do nothing
    return;
  }

  deleteAccountBtn.disabled = true;

  // 2. Get session (only to get email)
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError || !session) {
    actionMsg("You are not logged in.", "error");
    deleteAccountBtn.disabled = false;
    return;
  }

  const email = session.user.email;

  // 3. Call the public Edge Function using fetch()
  try {
    const res = await fetch(
      "https://qqactsebaxdottiiyrng.supabase.co/functions/v1/request-account-deletion",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      },
    );

    // HTTP-level error
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      console.error("HTTP error:", errBody);
      actionMsg(errBody.error || "Could not start deletion process.", "error");
      deleteAccountBtn.disabled = false;
      return;
    }

    // Function-level response
    const json = await res.json().catch(() => ({}));

    if (json.error) {
      actionMsg(json.error, "error");
      deleteAccountBtn.disabled = false;
      return;
    }

    // SUCCESS
    actionMsg("If this email exists, we sent a confirmation link.", "success");
  } catch (err) {
    console.error("Network error:", err);
    actionMsg("Network error. Please try again.", "error");
  } finally {
    deleteAccountBtn.disabled = false;
  }
}


