import { supabase } from "../supabase.js";
import { buttonLoading } from "../ui.js";


//Signup funtion
async function signup(name, email, password) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });

  if (error) {
    alert(error.message);
    return false;
  }

  if (data.user) {
    const { error: profileError } = await supabase.from("profiles").insert([
      {
        id: data.user.id,
        full_name: name,
      },
    ]);

    if (profileError) {
      alert(profileError.message);
      return false;
    }
  }

  alert("Account created successfully!");
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
      alert("All fields must not be empty");
      return;
    } else if (!email.includes("@")) {
      alert("Please enter a valid email");
      return;
    } else if (password != confirmPassword) {
      alert("Passwords do not match");
      return;
    } else if (password.length < 6) {
      alert("Password must be at least 6 characters");
      return;
    }

    //disable button
    const button = signupForm.querySelector("button");
    button.disabled = true;
    buttonLoading(button);

    try {
      const success = await signup(name, email, password);

      if (success) {
        const { data } = await supabase.auth.getSession();
        const session = encodeURIComponent(JSON.stringify(data.session));

        window.location.href = `https://app.loghue.com/#session=${session}`;
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
    alert(error.message);
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
        alert("All fields must not be empty");
        return;
      }

      const button = document.getElementById("loginBtn");
      button.disabled = true;
      buttonLoading(button);

      try {
        const success = await login(email, password);

        if (success) {
          const { data } = await supabase.auth.getSession();
          const session = encodeURIComponent(JSON.stringify(data.session));

          window.location.href = `https://app.loghue.com/#session=${session}`;

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
  alert("Logged out successfully!");
  window.location.href = "https://auth.loghue.com";
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
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: "https://auth.loghue.com",
      },
    });
    if (error) {
      alert(`OAuth error: ${error.message}`);
      window.location.href = "https://auth.loghue.com";
    }
  });
}

//Implement OAuths

//Google Auth
setupOAuthButton("googleAuth", "google");
setupOAuthButton("microsoftAuth", "azure");
setupOAuthButton("githubAuth", "github");
