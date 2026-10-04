import { sessionState, sessionReady } from "../session.js";
async function protectAppPage() {
    await sessionReady;
    if (sessionState.user) {
        window.location.href = `/`;
        return;
    }
    // User is logged in, continue loading the page
}
protectAppPage();
//# sourceMappingURL=authSessionProtect.js.map