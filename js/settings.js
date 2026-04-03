import { sessionState } from "./session.js";
import { supabase } from "./supabase.js";
import {actionMsg} from "./utils/modals.js"
import { registerPush, VAPID_PUBLIC_KEY } from "./push.js";

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

actionMsg("Check your inbox to confirm the new email", "success");  
}

  //AVATAR CHANGED?
  if (pendingAvatarProfile) {
    const filePath = `${user.id}-${Date.now()}.webp`;

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
      .eq("id", user.id);

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
export async function deleteAccount() {
  const deleteAccountBtn = document.getElementById("deleteAccount");
  if (!deleteAccountBtn) return;
console.log("delete")

  deleteAccountBtn.addEventListener("click", async () => {
    // Prevent double clicks 
if (deleteAccountBtn.disabled) return;
deleteAccountBtn.disabled = true;

    const confirmAction = confirm(
      "Are you sure you want to delete this account? This action cannot be undone.",
    );

    if (!confirmAction) {
      
      deleteAccountBtn.disabled = false;
      return;
    }

    try {
      // Get current session
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) {
        console.error("Session error:", sessionError);
        alert("Unable to get session.");
        return;
      }

      if (!session) {
        alert("You are not logged in.");
        return;
      }

      const userId = session.user.id;

      // Call Edge Function with auth header and proper body
      const { data, error } = await supabase.functions.invoke(
        "self-delete-user",
        {
          body: JSON.stringify({ user_id: userId }),
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            apikey: supabase.supabaseKey,
            "Content-Type": "application/json",
          },
        },
      );



      // Handle invocation-level error
      if (error) {
        console.error("Edge function invocation error:", error);
        alert(error.message || "Failed to call delete function.");
        return;
      }

      // Edge function returned data — inspect shape
      // Expected success: { ok: true, rpc: {...}, storage: 'attempted', auth_deleted: true }
      // Expected RPC error about active workspaces surfaced as { error: 'user owns X active workspace(s); aborting deletion' }
      if (data?.error) {
        // Show RPC-level or function-level error message
        alert(data.error);
        return;
      }

      if (data?.ok) {
        // Successful full deletion
        await supabase.auth.signOut();
        alert("Account deleted successfully.");
        window.location.href = "auth.html";
        return;
      }

      // Partial success handling: show details if present
      console.warn("Delete function returned unexpected response:", data);
      const msg =
        data?.rpc?.message ||
        data?.auth_delete_error ||
        "Account deletion did not complete. Check server logs.";
      alert(msg);
    } catch (err) {
      console.error("Unexpected error:", err);
      alert(err?.message || "Something went wrong.");
    } finally {
      
      deleteAccountBtn.disabled = false;
    }
  });
}
deleteAccount();

