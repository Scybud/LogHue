import { sessionState } from "./session.js";
import { supabase } from "./supabase.js";
async function initUserSettingsData () {

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
       .select("*")
       .eq("id", user.id)
       .single();
   
     if (profileError) {
       console.error(profileError);
       return;
     }
   
     sessionState.user = user;
     sessionState.profile = profile;

     loadData()
}


function loadData() {
   const accNameEl = document.getElementById("accName")
const accEmailEl = document.getElementById("accEmail")

if(accNameEl) {
   accNameEl.value = sessionState.profile.full_name;
}
if(accEmailEl) {
   accEmailEl.value = sessionState.user.email;
}
}

initUserSettingsData()


//PROFILE PHOTO UPLOAD
const profilePhotoInput = document.getElementById("profilePhotoInput")
const profileUploadBtn = document.getElementById("profileUploadBtn")
const settingsAvatar = document.querySelector(".settingsAvatar")

//TRIGGER IMAGE INPUT FIELD
profileUploadBtn.addEventListener("click", () => {
  profilePhotoInput.click();
});

//SHOW PREVIEW
profilePhotoInput.addEventListener("change", () => {
  const file = profilePhotoInput.files[0]
  if(!file) return;

  settingsAvatar.src = URL.createObjectURL(file)
})