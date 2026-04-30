import {
    startRegistration,
    startAuthentication,
} from "https://esm.sh/@simplewebauthn/browser@10.0.0";

import { client } from "./rpc-client.js";

/**
 * Begins passkey registration flow.
 * @param {string} name - Display name for the new user
 * @returns {Promise<{ user: import("../../shared/types.js").AuthUser }>}
 */
export async function registerWithPasskey(name) {
    // 1. Get registration options from server
    const startRes = await client.api.auth["register/start"].$post({ json: { name } });
    const startData = await startRes.json();
    const { options, challengeId } = startData.data;

    // 2. Prompt browser for passkey
    const credential = await startRegistration({ optionsJSON: options });

    // 3. Send credential to server
    const finishRes = await client.api.auth["register/finish"].$post({
        json: { credential: credential.toJSON(), challengeId },
    });
    const finishData = await finishRes.json();
    return finishData.data;
}

/**
 * Begins passkey authentication flow.
 * @returns {Promise<{ user: import("../../shared/types.js").AuthUser }>}
 */
export async function loginWithPasskey() {
    // 1. Get auth options from server
    const startRes = await client.api.auth["login/start"].$post();
    const startData = await startRes.json();
    const { options, challengeId } = startData.data;

    // 2. Prompt browser for passkey
    const credential = await startAuthentication({ optionsJSON: options });

    // 3. Send assertion to server
    const finishRes = await client.api.auth["login/finish"].$post({
        json: { credential: credential.toJSON(), challengeId },
    });
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
    const data = await res.json();
    return data.data;
}

/**
 * Checks current session.
 * @returns {Promise<{ user: import("../../shared/types.js").AuthUser } | null>}
 */
export async function getCurrentUser() {
    const res = await client.api.auth.me.$get();
    if (res.status === 401) {
        return null;
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
