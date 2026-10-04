import { sessionState, sessionReady } from "../session.js";

async function protectAppPage(): Promise<void> {
  await sessionReady;

  if (sessionState.user) {
    window.location.href = `/`;
    return;
  }

  // User is logged in, continue loading the page
}

protectAppPage();