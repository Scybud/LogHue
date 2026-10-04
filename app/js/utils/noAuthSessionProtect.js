import { sessionState, sessionReady } from "../session.js";

async function protectAppPage() {
  await sessionReady;
const redirectUrl = encodeURIComponent(window.location.href);

  if (!sessionState.user) {
    window.location.href = `/pages/auth?redirect=${redirectUrl}`;
    return;
  }

  // User is logged in, continue loading the page
}

protectAppPage();
