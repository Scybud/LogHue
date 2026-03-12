import { sessionState, sessionReady } from "../session.js";

async function protectAppPage() {
  await sessionReady;

  if (!sessionState.user) {
    window.location.href = "https://auth.loghue.com";
    return;
  }

  // User is logged in, continue loading the page
}

protectAppPage();
