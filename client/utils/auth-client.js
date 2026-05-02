import { startRegistration, startAuthentication } from "@simplewebauthn/browser";

import { client } from "./rpc-client.js";

/**
 * Begins passkey registration flow.
 * @param {string} name - Display name for the new user
 * @returns {Promise<{ user: import("../../shared/types.js").AuthUser }>}
 */
export async function registerWithPasskey(name) {
    // 1. Get registration options from server
    const startRes = await client.api.auth.register.start.$post({ json: { name } });
    if (!startRes.ok) {
        const errorData = await startRes.json();
        throw new Error(errorData.message || "Registration failed");
    }
    const startData = await startRes.json();
    const { options, challengeId, webauthnUserId } = startData.data;

    // 2. Prompt browser for passkey
    const authenticatorAnswer = await startRegistration({ optionsJSON: options });

    // 3. Send credential and challenge/user identifiers to server
    const verificationResponse = await client.api.auth.register.verify.$post({
        json: { credential: authenticatorAnswer, challengeId, webauthnUserId },
    });
    if (!verificationResponse.ok) {
        const errorData = await verificationResponse.json();
        throw new Error(errorData.message || "Registration failed");
    }
    const finishData = await verificationResponse.json();
    return finishData.data;
}

/**
 * Begins passkey authentication flow.
 * @returns {Promise<{ user: import("../../shared/types.js").AuthUser }>}
 */
export async function loginWithPasskey() {
    // 1. Get auth options from server
    const startRes = await client.api.auth.login.start.$post({ json: {} });
    const startData = await startRes.json();
    const { options, challengeId } = startData.data;

    // 2. Prompt browser for passkey
    const credential = await startAuthentication({ optionsJSON: options });

    // 3. Send assertion to server
    const finishRes = await client.api.auth.login.finish.$post({
        json: { credential, challengeId },
    });
    if (!finishRes.ok) {
        const errorData = await finishRes.json();
        throw new Error(errorData.message || "Authentication failed");
    }
    const finishData = await finishRes.json();
    return finishData.data;
}

/**
 * Quick login for dev/test users (no passkey).
 * @param {string} userId
 * @returns {Promise<{ user: import("../../shared/types.js").AuthUser }>}
 */
export async function quickLogin(userId) {
    const res = await client.api.auth["quick-login"].$post({ json: { userId } });
    if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Quick login failed");
    }
    const data = await res.json();
    return data.data;
}

/**
 * Checks current session.
 * @returns {Promise<import("../../shared/types.js").AuthUser | null>}
 */
export async function getCurrentUser() {
    const res = await client.api.auth.me.$get();
    if (!res.ok) {
        return null; // Not logged in or session expired
    }
    const data = await res.json();
    return data.data;
}

/**
 * Logs out current session.
 */
export async function logout() {
    await client.api.auth.logout.$post();
}
