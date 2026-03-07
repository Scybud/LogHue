import { sessionState } from "./session.js";
import { supabase } from "./supabase.js";
import {buttonLoading} from "./ui.js"

async function initUserSettingsData() {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    console.error(error);
    alert(error.message + "." + " " + "Redirecting to login");
    window.location.href = "auth.html";
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
  deleteAccount();
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
}

initUserSettingsData();

//PROFILE PHOTO UPLOAD
const profilePhotoInput = document.getElementById("profilePhotoInput");
const profileUploadBtn = document.getElementById("profileUploadBtn");
const settingsAvatar = document.querySelector(".settingsAvatar");

//TRIGGER IMAGE INPUT FIELD
profileUploadBtn.addEventListener("click", () => {
  buttonLoading(profileUploadBtn);
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
const saveBtn = document.querySelector(".settingsSaveBtn");

saveBtn.addEventListener("click", async () => {
  buttonLoading(saveBtn)

  const updates = {};
  const user = sessionState.user;

  const newName = document.getElementById("accName").value;
  const newEmail = document.getElementById("accEmail").value;

  //EMPTY FIELD?
  if (newName === "" || newEmail === "") {
    buttonLoading(saveBtn);
    alert("All fields must be filled");
    return;
  }

  //NAME CHANGED?
  if (newName != sessionState.originalName) {
    updates.full_name = newName;
  }

  //EMAIL CHANGED?
  if (newEmail != sessionState.originalEmail) {
    updates.email = newEmail;
  }

  //AVATAR CHANGED?
  if (pendingAvatarProfile) {
    const filePath = `${user.id}-${Date.now()}.webp`;

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(filePath, pendingAvatarProfile, { upsert: true });

    if (uploadError) {
          buttonLoading(saveBtn);

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
          buttonLoading(saveBtn);

      console.error(error);
      return;
    }

    alert("Changes saved!");
        buttonLoading(saveBtn);

  }

  pendingAvatarProfile = null;
});


//ACCOUNT DELETION
export async function deleteAccount() {
  const deleteAccountBtn = document.getElementById("deleteAccount");

  if (!deleteAccountBtn) return;

  deleteAccountBtn.addEventListener("click", async () => {
        buttonLoading(deleteAccountBtn);

    const confirmAction = confirm(
      "Are you sure you want to delete this account? This action cannot be undone.",
    );

    if (!confirmAction) {
          buttonLoading(deleteAccountBtn);
return
    } 

    if (confirmAction) {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      // 1. Delete user-related data

      //Fetch all workspaces created by user
      const { data: workspaces, error: wsError } = await supabase
        .from("workspaces")
        .select("status")
        .eq("created_by", user.id);

      if (wsError) {
            buttonLoading(deleteAccountBtn);

        console.error(wsError);
        alert(wsError.message);
        return;
      }

      //Check for active workspaces
      const hasActive = workspaces.some((ws) => ws.status === "active");

      if (hasActive) {
            buttonLoading(deleteAccountBtn);

        alert(
          "Some created workspaces are still active. Close workspaces to delete account ",
        );
        return;
      }
      await supabase.from("workspaces").delete().eq("user_id", user.id);
      await supabase.from("tasks").delete().eq("user_id", user.id);
      await supabase.from("task_comments").delete().eq("user_id", user.id);
      await supabase.from("workspace_members").delete().eq("user_id", user.id);
      await supabase
        .from("discussion_comments")
        .delete()
        .eq("user_id", user.id);
      await supabase.from("discussions").delete().eq("user_id", user.id);
      await supabase.from("profiles").delete().eq("id", user.id);
      await supabase.from("plan").delete().eq("user_id", user.id);
      localStorage.clear();

      // 2. Delete the user from Auth
       const { data, error } = await supabase.functions.invoke('self-delete-user', {
    method: 'POST',
    body: { confirm: true },
  });

      if (error) {
            buttonLoading(deleteAccountBtn);

        console.error(error);
        alert(error.message);
        return;
      }

      console.log(data);
      alert("Account deleted");
      buttonLoading(deleteAccountBtn);
      await supabase.auth.signOut();
      // 3. Redirect or show goodbye screen
      window.location.href = "auth.html";
    }
  });
}
