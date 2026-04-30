import { zValidator } from "@hono/zod-validator";
import {
    generateRegistrationOptions,
    verifyRegistrationResponse,
    generateAuthenticationOptions,
    verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import { Hono } from "hono";
import { z } from "zod";

import {
    startRegistrationSchema,
    finishRegistrationSchema,
    startAuthenticationSchema,
    finishAuthenticationSchema,
    quickLoginSchema,
    addDeviceStartSchema,
} from "../../shared/auth-schemas.js";
import { db } from "../db/database.js";
import * as queries from "../db/queries.js";
import { SEED_IDS } from "../db/seed.js";
import {
    sessionMiddleware,
    setSessionCookie,
    clearSessionCookie,
    SESSION_DURATION_MS,
} from "../middleware/session.js";
import { getUserId, getSessionId } from "../utils/context.js";

const rpID = process.env.WEBAUTHN_RP_ID || "localhost";
const rpName = "Pathfinder Librarian";
const origin = process.env.WEBAUTHN_ORIGIN || "http://localhost:3000";

/**
 * Formats a user row for API responses.
 * @param {{ id: string, name: string, initials: string, subtitle: string, mode: string, email: string | null, isTestUser: boolean, webauthnUserId: string | null } | null} user
 */
function formatUser(user) {
    if (!user) {
        return null;
    }
    return {
        id: user.id,
        name: user.name,
        initials: user.initials,
        subtitle: user.subtitle,
        mode: user.mode,
        email: user.email,
        isTestUser: user.isTestUser,
        webauthnUserId: user.webauthnUserId,
    };
}

/**
 * Creates an auth sub-router.
 */
export function createAuthRouter() {
    return new Hono()
        .post("/register/start", zValidator("json", startRegistrationSchema), async (c) => {
            const { name } = c.req.valid("json");

            const initials = name
                .split(" ")
                .map((word) => word[0].toUpperCase())
                .slice(0, 2)
                .join("");

            /** @type {{ id: string, name: string, initials: string, subtitle: string, mode: string, email: string | null, isTestUser: boolean, webauthnUserId: string | null } | undefined} */
            let user = queries
                .getUsers(db)
                .find((u) => u.name.toLowerCase() === name.toLowerCase());

            if (!user) {
                const newUser = queries.createUser(db, {
                    name,
                    initials,
                    subtitle: "",
                    mode: "gm",
                    email: null,
                    isTestUser: false,
                });

                const webauthnUserId = crypto.randomUUID();
                db.run("UPDATE users SET webauthn_user_id = ? WHERE id = ?", [
                    webauthnUserId,
                    newUser.id,
                ]);

                user = queries.getUserById(db, newUser.id) ?? undefined;
            } else if (!user.webauthnUserId) {
                const webauthnUserId = crypto.randomUUID();
                db.run("UPDATE users SET webauthn_user_id = ? WHERE id = ?", [
                    webauthnUserId,
                    user.id,
                ]);
                user = queries.getUserById(db, user.id) ?? undefined;
            }

            if (!user || !user.webauthnUserId) {
                return c.json({ result: "error", message: "User not found" }, 404);
            }

            const webauthnUserIdBuffer = Buffer.from(
                /** @type {string} */ (user.webauthnUserId).replace(/-/g, ""),
                "hex",
            );

            const options = await generateRegistrationOptions({
                rpName,
                rpID,
                userID: webauthnUserIdBuffer,
                userName: user.name,
                userDisplayName: user.name,
                excludeCredentials: queries.getCredentialsByUser(db, user.id).map((cred) => ({
                    id: cred.id,
                    transports:
                        /** @type {import("@simplewebauthn/types").AuthenticatorTransport[]} */ (
                            cred.transports || []
                        ),
                })),
                authenticatorSelection: {
                    authenticatorAttachment: "platform",
                    userVerification: "preferred",
                },
            });

            const challenge = queries.createChallenge(db, {
                challenge: options.challenge,
                type: "registration",
            });

            return c.json({
                result: "success",
                data: {
                    options,
                    challengeId: challenge.id,
                },
            });
        })
        .post("/register/finish", zValidator("json", finishRegistrationSchema), async (c) => {
            const { credential, challengeId } = c.req.valid("json");

            const challenge = queries.getChallengeById(db, challengeId);
            if (!challenge) {
                return c.json({ result: "error", message: "Invalid challenge" }, 400);
            }

            const verification = await verifyRegistrationResponse({
                response:
                    /** @type {import("@simplewebauthn/types").RegistrationResponseJSON} */ (
                        /** @type {unknown} */ (credential)
                    ),
                expectedChallenge: challenge.challenge,
                expectedOrigin: origin,
                expectedRPID: rpID,
            });

            if (!verification.verified || !verification.registrationInfo) {
                return c.json({ result: "error", message: "Registration failed" }, 400);
            }

            const { registrationInfo } = verification;
            const {
                credentialID,
                credentialPublicKey,
                counter,
                credentialDeviceType,
                credentialBackedUp,
            } = registrationInfo;

            // Find user by matching webauthnUserId from credential
            const allUsers = queries.getUsers(db);
            const user = allUsers.find((u) => u.webauthnUserId);
            if (!user) {
                return c.json({ result: "error", message: "User not found" }, 404);
            }

            const credentialIdBase64 = Buffer.from(credentialID).toString("base64");
            const publicKeyBase64 = Buffer.from(credentialPublicKey).toString("base64");
            queries.createCredential(db, {
                id: credentialIdBase64,
                userId: user.id,
                publicKey: publicKeyBase64,
                counter,
                deviceType: credentialDeviceType,
                backedUp: credentialBackedUp,
                transports: [],
                aaguid: registrationInfo.aaguid || "",
            });

            queries.deleteChallenge(db, challengeId);

            const token = crypto.randomUUID();
            const expiresAt = new Date(Date.now() + SESSION_DURATION_MS).toISOString();
            const _session = queries.createSession(db, { userId: user.id, token, expiresAt });

            setSessionCookie(c, token);

            const updatedUser = queries.getUserById(db, user.id);

            return c.json({
                result: "success",
                data: {
                    user: formatUser(updatedUser),
                },
            });
        })
        .post("/login/start", zValidator("json", startAuthenticationSchema), async (c) => {
            const allCredentials = queries
                .getUsers(db)
                .flatMap((user) => queries.getCredentialsByUser(db, user.id));

            const options = await generateAuthenticationOptions({
                rpID,
                userVerification: "preferred",
                allowCredentials: allCredentials.map((cred) => ({
                    id: Buffer.from(cred.id, "base64").toString("base64"),
                    transports:
                        /** @type {import("@simplewebauthn/types").AuthenticatorTransport[]} */ (
                            cred.transports || []
                        ),
                })),
            });

            const challenge = queries.createChallenge(db, {
                challenge: options.challenge,
                type: "authentication",
            });

            return c.json({
                result: "success",
                data: {
                    options,
                    challengeId: challenge.id,
                },
            });
        })
        .post("/login/finish", zValidator("json", finishAuthenticationSchema), async (c) => {
            const { credential, challengeId } = c.req.valid("json");

            const challenge = queries.getChallengeById(db, challengeId);
            if (!challenge) {
                return c.json({ result: "error", message: "Invalid challenge" }, 400);
            }

            const credentialIdBase64 = Buffer.from(
                /** @type {string} */ (/** @type {unknown} */ (credential.id)),
            ).toString("base64");
            const storedCredential = queries.getCredentialById(db, credentialIdBase64);
            if (!storedCredential) {
                return c.json({ result: "error", message: "Credential not found" }, 404);
            }

            const verification = await verifyAuthenticationResponse({
                response:
                    /** @type {import("@simplewebauthn/types").AuthenticationResponseJSON} */ (
                        /** @type {unknown} */ (credential)
                    ),
                expectedChallenge: challenge.challenge,
                expectedOrigin: origin,
                expectedRPID: rpID,
                authenticator: {
                    credentialID: storedCredential.id,
                    credentialPublicKey: Buffer.from(storedCredential.publicKey, "base64"),
                    counter: storedCredential.counter,
                    transports:
                        /** @type {import("@simplewebauthn/types").AuthenticatorTransport[]} */ (
                            storedCredential.transports || []
                        ),
                },
            });

            if (!verification.verified) {
                return c.json({ result: "error", message: "Authentication failed" }, 400);
            }

            queries.updateCredentialCounter(
                db,
                credentialIdBase64,
                verification.authenticationInfo.newCounter,
            );

            const user = queries.getUserById(db, storedCredential.userId);
            if (!user) {
                return c.json({ result: "error", message: "User not found" }, 404);
            }

            queries.deleteChallenge(db, challengeId);

            const token = crypto.randomUUID();
            const expiresAt = new Date(Date.now() + SESSION_DURATION_MS).toISOString();
            const _session = queries.createSession(db, { userId: user.id, token, expiresAt });

            setSessionCookie(c, token);

            return c.json({
                result: "success",
                data: {
                    user: formatUser(user),
                },
            });
        })
        .post("/quick-login", zValidator("json", quickLoginSchema), async (c) => {
            if (process.env.NODE_ENV === "production") {
                return c.json({ result: "error", message: "Not available in production" }, 403);
            }

            const { userId } = c.req.valid("json");

            const user = queries.getUserById(db, userId);
            if (!user) {
                return c.json({ result: "error", message: "User not found" }, 404);
            }

            if (!user.isTestUser) {
                return c.json({ result: "error", message: "Not a test user" }, 403);
            }

            const token = crypto.randomUUID();
            const expiresAt = new Date(Date.now() + SESSION_DURATION_MS).toISOString();
            const _session = queries.createSession(db, { userId: user.id, token, expiresAt });

            setSessionCookie(c, token);

            return c.json({
                result: "success",
                data: {
                    user: formatUser(user),
                },
            });
        })
        .get("/test-users", async (c) => {
            if (process.env.NODE_ENV === "production") {
                return c.json({ result: "error", message: "Not available in production" }, 403);
            }

            const testUserIds = [SEED_IDS.USER_DEFAULT, SEED_IDS.USER_TEST_PLAYER];
            const users = testUserIds
                .map((id) => queries.getUserById(db, id))
                .filter((u) => u !== null);

            return c.json({
                result: "success",
                data: users.map((u) => ({
                    id: u.id,
                    name: u.name,
                    mode: u.mode,
                })),
            });
        })
        .get("/me", sessionMiddleware(), async (c) => {
            const userId = getUserId(c);
            const user = queries.getUserById(db, userId);
            return c.json({
                result: "success",
                data: formatUser(user),
            });
        })
        .post("/logout", sessionMiddleware(), async (c) => {
            const sessionId = getSessionId(c);
            queries.deleteSession(db, sessionId);
            clearSessionCookie(c);
            return c.json({ result: "success" });
        })
        .post(
            "/device/start",
            sessionMiddleware(),
            zValidator("json", addDeviceStartSchema),
            async (c) => {
                const userId = getUserId(c);

                const user = queries.getUserById(db, userId);
                if (!user) {
                    return c.json({ result: "error", message: "User not found" }, 404);
                }

                const webauthnUserIdBuffer = user.webauthnUserId
                    ? Buffer.from(user.webauthnUserId.replace(/-/g, ""), "hex")
                    : new Uint8Array(0);

                const options = await generateRegistrationOptions({
                    rpName,
                    rpID,
                    userID: webauthnUserIdBuffer,
                    userName: user.name,
                    userDisplayName: user.name,
                    excludeCredentials: queries.getCredentialsByUser(db, userId).map((cred) => ({
                        id: cred.id,
                        transports:
                            /** @type {import("@simplewebauthn/types").AuthenticatorTransport[]} */ (
                                cred.transports || []
                            ),
                    })),
                    authenticatorSelection: {
                        authenticatorAttachment: "cross-platform",
                        userVerification: "preferred",
                    },
                });

                const challenge = queries.createChallenge(db, {
                    challenge: options.challenge,
                    type: "device-registration",
                });

                return c.json({
                    result: "success",
                    data: {
                        options,
                        challengeId: challenge.id,
                    },
                });
            },
        )
        .post(
            "/device/finish",
            sessionMiddleware(),
            zValidator("json", finishRegistrationSchema),
            async (c) => {
                const { credential, challengeId } =
                    /** @type {{ credential: Record<string, unknown>, challengeId: string }} */ (
                        c.req.valid("json")
                    );
                const userId = getUserId(c);

                const challenge = queries.getChallengeById(db, challengeId);
                if (!challenge) {
                    return c.json({ result: "error", message: "Invalid challenge" }, 400);
                }

                const verification = await verifyRegistrationResponse({
                    response:
                        /** @type {import("@simplewebauthn/types").RegistrationResponseJSON} */ (
                            /** @type {unknown} */ (credential)
                        ),
                    expectedChallenge: challenge.challenge,
                    expectedOrigin: origin,
                    expectedRPID: rpID,
                });

                if (!verification.verified || !verification.registrationInfo) {
                    return c.json({ result: "error", message: "Registration failed" }, 400);
                }

                const { registrationInfo } = verification;
                const {
                    credentialID,
                    credentialPublicKey,
                    counter,
                    credentialDeviceType,
                    credentialBackedUp,
                } = registrationInfo;

                const credentialIdBase64 = Buffer.from(credentialID).toString("base64");
                const publicKeyBase64 = Buffer.from(credentialPublicKey).toString("base64");
                queries.createCredential(db, {
                    id: credentialIdBase64,
                    userId,
                    publicKey: publicKeyBase64,
                    counter,
                    deviceType: credentialDeviceType,
                    backedUp: credentialBackedUp,
                    transports: [],
                    aaguid: registrationInfo.aaguid || "",
                });

                queries.deleteChallenge(db, challengeId);

                return c.json({ result: "success" });
            },
        )
        .delete(
            "/device/:credentialId",
            sessionMiddleware(),
            zValidator("param", z.object({ credentialId: z.string() })),
            async (c) => {
                const { credentialId } =
                    /** @type {{ credentialId: string }} */ (c.req.valid("param"));
                const userId = getUserId(c);

                const credential = queries.getCredentialById(db, credentialId);
                if (!credential) {
                    return c.json({ result: "error", message: "Credential not found" }, 404);
                }

                if (credential.userId !== userId) {
                    return c.json({ result: "error", message: "Unauthorized" }, 403);
                }

                const userCredentials = queries.getCredentialsByUser(db, userId);
                if (userCredentials.length <= 1) {
                    return c.json(
                        { result: "error", message: "Cannot remove last credential" },
                        400,
                    );
                }

                queries.deleteCredential(db, credentialId);

                return c.json({ result: "success" });
            },
        )
        .get("/devices", sessionMiddleware(), async (c) => {
            const userId = getUserId(c);
            const credentials = queries.getCredentialsByUser(db, userId);

            return c.json({
                result: "success",
                data: credentials.map((cred) => ({
                    id: cred.id,
                    deviceType: cred.deviceType,
                    backedUp: cred.backedUp,
                    createdAt: cred.createdAt,
                })),
            });
        });
}

const auth = createAuthRouter();
export { auth as authRouter };
