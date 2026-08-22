import { sessionState, sessionReady } from "../session.js";

async function protectAppPage(): Promise<void> {
  await sessionReady;

  const redirectUrl: string = window.location.href;

  if (!sessionState.user) {
    window.location.href = `auth?redirect=${redirectUrl}`;
    return;
  }

  // User is logged in, continue loading the page
}

protectAppPage();