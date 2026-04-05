supabase.auth.getSession().then(({ data }) => {
  if (!data.session) return;

  // Read ?redirect=... from the callback URL
  const params = new URLSearchParams(window.location.search);
  const redirectTo = params.get("redirect");

  if (redirectTo) {
    // Send them to the intended page (invite, workspace, etc.)
    window.location.href = decodeURIComponent(redirectTo);
  } else {
    // Default fallback
    window.location.href = "../";
  }
});
