import { supabase } from "../supabase.js";
import { buttonLoading } from "../ui.js";

//PASSWORD RESET EMAIL FORM SUBMISSON FUNCTION
async function sendPasswordResetEmail(email, redirectPage) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: redirectPage,
  });
  if (error) {
    console.error(error);
    alert(error.message);
  } else {
    const successCard = document.querySelector(".success-card");
    const passwordResetEmailForm = document.getElementById(
      "passwordResetEmailForm",
    );
    passwordResetEmailForm.classList.add("hide");
    successCard.classList.add("showFlex");
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

    const button = document.getElementById("passwordResetEmailSubmitBtn");
    button.disabled = true;
    buttonLoading(button);

    const successCard = document.querySelector(".success-card");
    try {
      const success = await sendPasswordResetEmail(
        email,
        "https://auth.loghue.com/passwordChange.html",
      );

      if (success) {
        passwordResetEmailForm.classList.add("hide");
        successCard.classList.add("showFlex");
      }
    } finally {
      button.disabled = false;
      buttonLoading(button);

      document.getElementById("passwordResetEmail").value = "";
    }
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
    window.location.href = "https://app.loghue.com";
  }
}

//PASSWORD RESET EMAIL FORM SUBMISSON
const passwordChangeForm = document.getElementById("passwordChangeForm");

if (passwordChangeForm) {
  passwordChangeForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const password = document
      .getElementById("passwordResetNewPassword")
      .value.trim();

    await sendPasswordResetNewPassword(password);
  });
}
