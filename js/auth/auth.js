import { supabase } from "../supabase.js";
import { buttonLoading } from "../ui.js";
import { actionMsg } from "../utils/modals.js";


//Signup funtion
async function signup(name, email, password) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });

  if (error) {
    actionMsg(error.message, "error");
    return false;
  }

  if (data.user) {
    const { error: profileError } = await supabase.from("profiles").upsert([
      {
        id: data.user.id,
        full_name: name,
        email: email,
      },
    ]);

    if (profileError) {
      actionMsg(profileError.message, "error");
      return false;
    }
  }

  actionMsg("Account created successfully!", "success");
  return true;
}

//Signup form
const signupForm = document.getElementById("signupForm");
if (signupForm) {
  signupForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const name = document.getElementById("userSignupNameInput").value.trim();
    const email = document.getElementById("userSignupEmailInput").value.trim();
    const password = document
      .getElementById("userSignupPasswordInput")
      .value.trim();
    const confirmPassword = document
      .getElementById("userSignupConfirmPasswordInput")
      .value.trim();

    if (!name || !password || !email || !confirmPassword) {
      actionMsg("All fields must not be empty", "error");
      return;
    } else if (!email.includes("@")) {
      actionMsg("Please enter a valid email", "error");
      return;
    } else if (password != confirmPassword) {
      actionMsg("Passwords do not match", "error");
      return;
    } else if (password.length < 6) {
      actionMsg("Password must be at least 6 characters", "error");
      return;
    }

    //disable button
    const button = signupForm.querySelector("button");
    button.disabled = true;
    buttonLoading(button);

    try {
      const success = await signup(name, email, password);

      if (success) {

        // After successful login/signup:
        const params = new URLSearchParams(window.location.search);
        const redirectTo = params.get("redirect");

        if (redirectTo) {
          // Send them back to the invite page with the token
          window.location.href = decodeURIComponent(redirectTo);
        } else {
          // Default behavior
          window.location.href = "../create-workspace";
        }
      }
    } finally {
      button.disabled = false;
      buttonLoading(button);
    }
  });
}

//login funtion
async function login(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    actionMsg(error.message, "error");
    return false;
  }

  return true;
}

//Login form
export function loginFuntion() {
  const loginForm = document.getElementById("loginForm");
  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const email = document.getElementById("userLoginEmailInput").value.trim();
      const password = document
        .getElementById("userLoginPasswordInput")
        .value.trim();

      if (!password || !email) {
        actionMsg("All fields must not be empty", "error");
        return;
      }

      const button = document.getElementById("loginBtn");
      button.disabled = true;
      buttonLoading(button);

      try {
        const success = await login(email, password);

        if (success) {
          // After successful login/signup:
          const params = new URLSearchParams(window.location.search);
          const redirectTo = params.get("redirect");

          if (redirectTo) {
            // Send them back to the invite page with the token
            window.location.href = decodeURIComponent(redirectTo);
          } else {
            // Default behavior
            window.location.href = "../";
          }
        }
        
      } finally {
        button.disabled = false;
        buttonLoading(button);
      }
    });
  }
}
loginFuntion();

//signout
async function signout() {
  const { error } = await supabase.auth.signOut();

  if (error) {
    alert(error.message);
    return;
  }
  actionMsg("Logged out successfully!", "success");

  setTimeout(() => {

    window.location.href = "/auth";
  }, 3000)
}

export function attachSignoutEvents() {
  document.addEventListener("click", (e) => {
    const btn = e.target.closest("#logoutBtn");

    if (btn) {
      if (!confirm("Are you sure you want to logout?")) return;

      signout();
    }
  });
}

//OAuth funtion
function setupOAuthButton(buttonId, provider) {
  const btn = document.getElementById(buttonId);
  if (!btn) return;

  btn.addEventListener("click", async () => {
    // Read redirect param from current URL
    const params = new URLSearchParams(window.location.search);
    const redirectTo = params.get("redirect");

    // Build callback URL with redirect param included
    const callbackUrl = "https://app.loghue.com/auth/callback";

    if (redirectTo) {
      localStorage.setItem("post_login_redirect", redirectTo);
    }
    
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: "https://app.loghue.com/auth/callback",
      },
    });

    if (error) {
      actionMsg(`OAuth error: ${error.message}`);
    }
  });
}


//Implement OAuths

//Google Auth
setupOAuthButton("googleAuth", "google");
setupOAuthButton("microsoftAuth", "azure");
setupOAuthButton("githubAuth", "github");
