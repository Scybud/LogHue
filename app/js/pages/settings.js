import { sessionState } from "../session.js";
import { supabase } from "../supabase.js";
import { actionMsg, confirmAction } from "../utils/modals.js";
import { registerPush } from "../push.js";

const DEFAULT_AVATAR = "https://loghue.com/assets/images/default_profile.png";

const MAX_SIZE = 200 * 1024; // 200KB

const profilePhotoInput = document.getElementById("profilePhotoInput");
const profileUploadBtn = document.getElementById("profileUploadBtn");
const settingsAvatar = document.querySelector(".settingsAvatar");
const saveBtn = document.querySelector(".settingsSaveBtn");

let pendingAvatarProfile = null;

// =========================
// INIT
// =========================
async function initUserSettingsData() {
  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      console.error(error);

      actionMsg("Session expired. Redirecting to login.", "error");

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
      actionMsg("Could not load profile.", "error");
      return;
    }

    sessionState.user = user;
    sessionState.profile = profile;

    sessionState.originalName = profile.full_name;
    sessionState.originalEmail = user.email;
    sessionState.originalAvatar = profile.avatar_url;

    loadData();
    initNotificationPreference();
  } catch (err) {
    console.error(err);
    actionMsg("Something went wrong.", "error");
  }
}

initUserSettingsData();

// =========================
// LOAD UI DATA
// =========================
function loadData() {
  const accNameEl = document.getElementById("accName");
  const accEmailEl = document.getElementById("accEmail");

  if (accNameEl) {
    accNameEl.value = sessionState.profile.full_name || "";
  }

  if (accEmailEl) {
    accEmailEl.value = sessionState.user.email || "";
  }

  settingsAvatar.src = sessionState.profile.avatar_url || DEFAULT_AVATAR;

  settingsAvatar.onerror = () => {
    settingsAvatar.src = DEFAULT_AVATAR;
  };
}

// =========================
// AVATAR UPLOAD
// =========================
profileUploadBtn?.addEventListener("click", () => {
  profilePhotoInput.click();
});

profilePhotoInput?.addEventListener("change", async () => {
  const file = profilePhotoInput.files?.[0];

  if (!file) return;

  try {
    const imageUrl = URL.createObjectURL(file);

    const img = new Image();
    img.src = imageUrl;

    img.onload = async () => {
      URL.revokeObjectURL(imageUrl);

      const compressedBlob = await compressImage(img);

      if (!compressedBlob) {
        actionMsg("Could not compress image below 200KB.", "error");

        profilePhotoInput.value = "";
        return;
      }

      pendingAvatarProfile = new File([compressedBlob], "avatar.webp", {
        type: "image/webp",
      });

      const previewUrl = URL.createObjectURL(compressedBlob);

      settingsAvatar.src = previewUrl;

      settingsAvatar.onload = () => {
        URL.revokeObjectURL(previewUrl);
      };
    };
  } catch (err) {
    console.error(err);
    actionMsg("Could not process image.", "error");
  }
});

async function compressImage(img) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  let width = img.width;
  let height = img.height;

  const MAX_DIMENSION = 500;

  if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
    const ratio = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height);

    width *= ratio;
    height *= ratio;
  }

  canvas.width = width;
  canvas.height = height;

  ctx.drawImage(img, 0, 0, width, height);

  let quality = 0.9;

  while (quality >= 0.3) {
    const blob = await new Promise((resolve) => {
      canvas.toBlob(resolve, "image/webp", quality);
    });

    if (blob && blob.size <= MAX_SIZE) {
      return blob;
    }

    quality -= 0.1;
  }

  return null;
}

// =========================
// SAVE SETTINGS
// =========================
saveBtn?.addEventListener("click", async () => {
  saveBtn.disabled = true;

  try {
    const updates = {};

    const newName = document.getElementById("accName").value.trim();

    const newEmail = document.getElementById("accEmail").value.trim();

    if (!newName || !newEmail) {
      actionMsg("All fields are required.", "error");
      return;
    }

    // =========================
    // NAME UPDATE
    // =========================
    if (newName !== sessionState.originalName) {
      updates.full_name = newName;
    }

    // =========================
    // EMAIL UPDATE
    // =========================
    if (newEmail !== sessionState.originalEmail) {
      const { error } = await supabase.auth.updateUser({
        email: newEmail,
      });

      if (error) {
        actionMsg(error.message, "error");
        return;
      }

      actionMsg("Check your inbox to confirm the new email.", "success");
    }

    // =========================
    // AVATAR UPDATE
    // =========================
    if (pendingAvatarProfile) {
      const oldPath = extractFilePath(sessionState.originalAvatar);

      const filePath = `${sessionState.user.id}-${Date.now()}.webp`;

      // Upload new avatar first
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, pendingAvatarProfile, {
          upsert: true,
          metadata: {
            owner: sessionState.user.id,
          },
        });

      if (uploadError) {
        console.error(uploadError);

        actionMsg("Could not upload avatar.", "error");

        return;
      }

      const { data: urlData } = supabase.storage
        .from("avatars")
        .getPublicUrl(filePath);

      updates.avatar_url = urlData.publicUrl;

      // Update DB before deleting old avatar
      const { error: profileError } = await supabase
        .from("profiles")
        .update(updates)
        .eq("id", sessionState.user.id);

      if (profileError) {
        console.error(profileError);

        // Rollback uploaded avatar
        await supabase.storage.from("avatars").remove([filePath]);

        actionMsg("Could not save avatar.", "error");

        return;
      }

      // Delete old avatar after success
      if (oldPath) {
        await supabase.storage.from("avatars").remove([oldPath]);
      }

      sessionState.originalAvatar = urlData.publicUrl;
    }

    // =========================
    // SAVE PROFILE CHANGES
    // =========================
    if (Object.keys(updates).length > 0 && !updates.avatar_url) {
      const { error } = await supabase
        .from("profiles")
        .update(updates)
        .eq("id", sessionState.user.id);

      if (error) {
        console.error(error);
        actionMsg("Could not save changes.", "error");
        return;
      }
    }

    actionMsg("Changes saved!", "success");

    pendingAvatarProfile = null;

    sessionState.originalName = newName;
    sessionState.originalEmail = newEmail;
  } catch (err) {
    console.error(err);
    actionMsg("Something went wrong.", "error");
  } finally {
    saveBtn.disabled = false;
  }
});

// =========================
// HELPERS
// =========================
function extractFilePath(publicUrl) {
  if (!publicUrl) return null;

  try {
    const url = new URL(publicUrl);

    const marker = "/object/public/avatars/";

    return url.pathname.split(marker)[1] || null;
  } catch {
    return null;
  }
}

// =========================
// PUSH NOTIFICATIONS
// =========================
function initNotificationPreference() {
  const checkbox = document.getElementById("enablePush");

  if (!checkbox) return;

  checkbox.checked = sessionState.profile.push_enabled || false;

  checkbox.addEventListener("change", async (e) => {
    const enabled = e.target.checked;

    try {
      if (enabled) {
        const success = await enablePushNotifications();

        if (!success) {
          checkbox.checked = false;
          return;
        }
      } else {
        await disablePushNotifications();
      }

      await supabase
        .from("profiles")
        .update({
          push_enabled: enabled,
        })
        .eq("id", sessionState.user.id);

      actionMsg(
        enabled ? "Push notifications enabled" : "Push notifications disabled",
        "success",
      );
    } catch (err) {
      console.error(err);

      checkbox.checked = !enabled;

      actionMsg("Could not update notification preference.", "error");
    }
  });
}

async function enablePushNotifications() {
  const subscription = await registerPush();

  if (subscription.error) {
    actionMsg(subscription.error, "error");
    return false;
  }

  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: sessionState.user.id,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
    },
    {
      onConflict: "endpoint",
    },
  );

  if (error) {
    console.error(error);
    actionMsg("Could not save subscription.", "error");
    return false;
  }

  return true;
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
      .eq("endpoint", subscription.endpoint);
  }
}

// =========================
// ACCOUNT DELETION
// =========================
export function requestAccountDeletion() {
  const deleteAccountBtn = document.getElementById("deleteAccount");

  if (!deleteAccountBtn) return;

  deleteAccountBtn.addEventListener("click", () => {
    confirmAction("Delete Account",
      "Are you sure you want to delete this account? We will send a confirmation email.",
      [
        {
          label: "Cancel",
          type: "cancel",
        },
        {
          label: "Continue",
          type: "confirm",
          onClick: performAccountDeletionProcess,
        },
      ],
    );
  });
}

requestAccountDeletion();

async function performAccountDeletionProcess() {
  const deleteAccountBtn = document.getElementById("deleteAccount");

  if (!deleteAccountBtn) return;

  if (deleteAccountBtn.disabled) return;

  deleteAccountBtn.disabled = true;

  try {
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError || !session) {
      actionMsg("You are not logged in.", "error");
      return;
    }

    // Check owned workspaces
    const { data: createdWorkspaces, error } = await supabase
      .from("workspaces")
      .select("id")
      .eq("created_by", session.user.id);

    if (error) {
      actionMsg("Could not verify workspace ownership.", "error");

      return;
    }

    if (createdWorkspaces?.length > 0) {
      actionMsg(
        "Transfer workspace ownership before deleting your account.",
        "error",
      );

      return;
    }

    const response = await fetch(
      "https://qqactsebaxdottiiyrng.supabase.co/functions/v1/request-account-deletion",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: session.user.email,
        }),
      },
    );

    const json = await response.json();

    if (!response.ok || json.error) {
      actionMsg(json.error || "Could not start account deletion.", "error");

      return;
    }

    actionMsg(`Confirmation email sent to ${session.user.email}`, "success");
  } catch (err) {
    console.error(err);

    actionMsg("Network error. Please try again.", "error");
  } finally {
    deleteAccountBtn.disabled = false;
  }
}
