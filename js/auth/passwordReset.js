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

