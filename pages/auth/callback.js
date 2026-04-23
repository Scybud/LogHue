supabase.auth.getSession().then(({ data }) => {
  if (!data.session) return;

  // Read ?redirect=... from the callback URL
  const params = new URLSearchParams(window.location.search);
  const redirectTo = params.get("redirect");

  if (redirectTo) {
    // Send user to the intended page
    window.location.href = decodeURIComponent(redirectTo);
  } else {
    // Default fallback
    window.location.href = "../";
  }
});
