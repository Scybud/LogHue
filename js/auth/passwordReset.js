import { supabase } from "../supabase.js";

//PASSWORD RESET EMAIL FORM SUBMISSON FUNCTION
async function sendPasswordResetEmail(email, redirectPage) {
   const { error } = await supabase.auth.resetPasswordForEmail(email, {
     redirectTo: redirectPage,
   });

     if (error) {
       console.error(error);
       alert(error.message);
     } else {
       alert("Password reset email sent!");
     }
}

//PASSWORD RESET EMAIL FORM SUBMISSON
const passwordResetEmailForm = document.getElementById(
  "passwordResetEmailForm",
);

if (passwordResetEmailForm) {

   passwordResetEmailForm.addEventListener("submit", async (e) => {
      e.preventDefault();

const email = document.getElementById("passwordResetEmail").value.trim();

await sendPasswordResetEmail(
  email,
  "https://scyflix.github.io/LogHue/pages/auth/passwordChange.html",
);
});
}


//PASSWORD CHANGE NEW PASSWORD FORM SUBMISSON FUNCTION
async function sendPasswordResetNewPassword(password) {
   const { error } = await supabase.auth.updateUser({
     password: password,
   });

     if (error) {
       console.error(error);
       alert(error.message);
     } else {
       alert("Password reset Complete!");
       window.location.href = "../dashboard.html"
     }
}



//PASSWORD RESET EMAIL FORM SUBMISSON
const passwordChangeForm = document.getElementById("passwordChangeForm")

if (passwordChangeForm) {
  passwordChangeForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const password = document
      .getElementById("passwordResetNewPassword")
      .value.trim();

    await sendPasswordResetEmail(
      password
    );
  });
}