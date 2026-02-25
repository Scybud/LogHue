import { supabase, getCurrentSession } from "./supabase.js";

//Signup funtion
async function signup(email, password) {
   const {data, error} = await supabase.auth.signUp({
      email, 
      password,
   })

   if(error) {
      alert(error.message)
      return
   }
   alert("Account created successfully!")
}


//Signup form
const signupForm = document.getElementById("signupForm");
if(signupForm) {

  signupForm.addEventListener("submit", async (e) => {
    e.preventDefault();

  const email = document.getElementById("userSignupEmailInput").value.trim();
  const password = document
    .getElementById("userSignupPasswordInput")
    .value.trim();
  const confirmPassword = document.getElementById(
  "userSignupConfirmPasswordInput",
).value.trim();

  if (!password || !email || !confirmPassword) {
    alert("All filed must not be empty");
    return;
  } else if (password != confirmPassword) {
    alert("Passords do not match");
    return;
  }

  await signup(email, password);
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
        return;
      }
      alert("Logged in successfully!");
}

//Login form
export function loginFuntion() {

  const loginForm = document.getElementById("loginForm");
  if(loginForm) {

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault()
    
    const email = document.getElementById("userLoginEmailInput").value.trim();
  const password = document
    .getElementById("userLoginPasswordInput")
    .value.trim();

  if (!password || !email) {
    alert("All filed must not be empty");
    return;
  }

  await login(email, password);
  window.location.href = "dashboard.html"
})
}
}

//REDIRECT IF USER LOGGED IN
const session = getCurrentSession()
if(session) {
  window.location.href = "dashboard.html"
}