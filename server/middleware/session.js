import { getCookie, setCookie } from "hono/cookie";

import { db as defaultDb } from "../db/database.js";
import {
    getSessionByToken,
    refreshSession,
    deleteSession as deleteSessionQuery,
} from "../db/queries.js";

const SESSION_COOKIE_NAME = "session_token";
const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/**
 * Hono middleware that validates the session cookie.
 * On success, sets c.set("userId", userId) and c.set("sessionId", sessionId).
 * On failure, returns 401.
 * @param {{ optional?: boolean, database?: import("bun:sqlite").Database }} options - If optional, does not 401 on missing session. If database is provided, uses that instead of default db.
 */
export function sessionMiddleware(options = {}) {
    const database = options.database || defaultDb;

    return async (c, next) => {
        // Try to get cookie using getCookie, or fall back to manual parsing
        let token = getCookie(c, SESSION_COOKIE_NAME);

        // Manual cookie parsing for test environment
        if (!token) {
            const cookieHeader = c.req.header("cookie");
            if (cookieHeader) {
                const match = cookieHeader.match(
                    new RegExp(`(^|;\\s*)${SESSION_COOKIE_NAME}=([^;]*)`),
                );
                token = match ? match[2] : null;
            }
        }

        // For testing, also check for custom header
        if (!token) {
            token = c.req.header("x-session-token");
        }

        if (!token) {
            if (options.optional) {
                return next();
            }
            return c.json({ result: "error", message: "Unauthorized" }, 401);
        }

        const session = getSessionByToken(database, token);

        if (!session) {
            if (options.optional) {
                return next();
            }
            return c.json({ result: "error", message: "Invalid session" }, 401);
        }

        // Check expiration
        if (new Date(session.expiresAt) < new Date()) {
            deleteSessionQuery(database, session.id);
            if (options.optional) {
                return next();
            }
            return c.json({ result: "error", message: "Session expired" }, 401);
        }

        // Refresh session on activity
        const newExpiresAt = new Date(Date.now() + SESSION_DURATION_MS).toISOString();
        refreshSession(database, session.id, { newExpiresAt });

        c.set("userId", session.userId);
        c.set("sessionId", session.id);
        return next();
    };
}

/**
 * Sets the session cookie.
 * @param {import("hono").Context} c - Hono context
 * @param {string} token - Session token
 */
export function setSessionCookie(c, token) {
    const isProduction = process.env.NODE_ENV === "production";
    const cookieValue = `${SESSION_COOKIE_NAME}=${token}; Path=/; Max-Age=${30 * 24 * 60 * 60}; SameSite=Lax${isProduction ? "; Secure; HttpOnly" : "; HttpOnly"}`;

    c.res.headers.set("Set-Cookie", cookieValue);
}

/**
 * Clears the session cookie.
 * @param {import("hono").Context} c - Hono context
 */
export function clearSessionCookie(c) {
    setCookie(c, SESSION_COOKIE_NAME, "", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "Lax",
        maxAge: 0,
        path: "/",
    });
}

export { SESSION_COOKIE_NAME, SESSION_DURATION_MS };
