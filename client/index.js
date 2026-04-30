import "./pages/login-page.js";
import "./pages/main-page.js";
import { getCurrentUser } from "./utils/auth-client.js";

/**
 * @typedef {import("../shared/types.js").AuthUser} AuthUser
 */

// Check session and render appropriate page
async function init() {
    const result = await getCurrentUser();
    if (result) {
        showMainApp(result);
    } else {
        showLoginPage();
    }
}

/**
 * @param {AuthUser} user
 */
function showMainApp(user) {
    document.body.innerHTML = "";
    const el = document.createElement("main-page");
    el.user = user;
    document.body.appendChild(el);
}

function showLoginPage() {
    document.body.innerHTML = "";
    const el = document.createElement("login-page");
    el.addEventListener("login-success", (e) => {
        /** @type {CustomEvent<{ user: AuthUser }>} */
        const event = e;
        showMainApp(event.detail.user);
    });
    document.body.appendChild(el);
}

init();

// Listen for logout events to show login page
document.addEventListener("user-logged-out", () => showLoginPage());
