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
import {
    sessionMiddleware,
    setSessionCookie,
    clearSessionCookie,
    SESSION_DURATION_MS,
} from "../middleware/session.js";

const rpID = process.env.WEBAUTHN_RP_ID || "localhost";
const rpName = "Pathfinder Librarian";
const origin = process.env.WEBAUTHN_ORIGIN || "http://localhost:3000";

/**
 * Creates an auth sub-router.
 */
export function createAuthRouter() {
    return new Hono()
        .post("/register/start", zValidator("json", startRegistrationSchema), async (c) => {
            const { name } = c.req.valid("json");

            // Generate initials from name (first letters of each word)
            const initials = name
                .split(" ")
                .map((word) => word[0].toUpperCase())
                .slice(0, 2)
                .join("");

            // Check if user exists by name (case-insensitive)
            let user = queries
                .getUsers(db)
                .find((u) => u.name.toLowerCase() === name.toLowerCase());

            if (!user) {
                // Create new user
                const newUser = queries.createUser(db, {
                    name,
                    initials,
                    subtitle: "",
                    mode: "gm",
                    email: null,
                    isTestUser: false,
                });

                // Set WebAuthn user ID (random UUID)
                const webauthnUserId = crypto.randomUUID();
                db.run("UPDATE users SET webauthn_user_id = ? WHERE id = ?", [
                    webauthnUserId,
                    newUser.id,
                ]);

                user = {
                    ...newUser,
                    webauthnUserId,
                };
            } else if (!user.webauthnUserId) {
                // Set WebAuthn user ID if missing
                const webauthnUserId = crypto.randomUUID();
                db.run("UPDATE users SET webauthn_user_id = ? WHERE id = ?", [
                    webauthnUserId,
                    user.id,
                ]);
                user = {
                    ...user,
                    webauthnUserId,
                };
            }

            // Convert UUID string to Buffer for WebAuthn
            const webauthnUserIdBuffer = Buffer.from(user.webauthnUserId.replace(/-/g, ""), "hex");

            // Generate registration options
            const options = await generateRegistrationOptions({
                rpName,
                rpID,
                userID: webauthnUserIdBuffer,
                userName: user.name,
                userDisplayName: user.name,
                excludeCredentials: queries.getCredentialsByUser(db, user.id).map((cred) => ({
                    id: cred.id,
                    transports: cred.transports || [],
                })),
                authenticatorSelection: {
                    authenticatorAttachment: "platform",
                    userVerification: "preferred",
                },
            });

            // Store challenge
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

            // Get and verify challenge
            const challenge = queries.getChallengeById(db, challengeId);
            if (!challenge) {
                return c.json({ result: "error", message: "Invalid challenge" }, 400);
            }

            // Verify registration response
            const verification = await verifyRegistrationResponse({
                response: credential,
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

            // Find user by WebAuthn user ID
            const webauthnUserInfo = registrationInfo.user;
            if (!webauthnUserInfo) {
                return c.json({ result: "error", message: "User not found" }, 404);
            }
            let user = queries.getUserByWebauthnUserId(db, webauthnUserInfo.id);
            if (!user) {
                return c.json({ result: "error", message: "User not found" }, 404);
            }

            // Store credential
            const credentialIdBase64 = Buffer.from(credentialID).toString("base64");
            const publicKeyBase64 = Buffer.from(credentialPublicKey).toString("base64");
            queries.createCredential(db, {
                id: credentialIdBase64,
                userId: user.id,
                publicKey: publicKeyBase64,
                counter,
                deviceType: credentialDeviceType,
                backedUp: credentialBackedUp,
                transports: credential.transports || [],
                aaguid: verification.registrationInfo?.aaguid || "",
            });

            // Delete challenge
            queries.deleteChallenge(db, challengeId);

            // Create session
            const token = crypto.randomUUID();
            const expiresAt = new Date(Date.now() + SESSION_DURATION_MS).toISOString();
            const _session = queries.createSession(db, { userId: user.id, token, expiresAt });

            // Set session cookie
            setSessionCookie(c, token);

            // Get updated user
            const updatedUser = queries.getUserById(db, user.id);

            return c.json({
                result: "success",
                data: {
                    user: {
                        id: updatedUser.id,
                        name: updatedUser.name,
                        initials: updatedUser.initials,
                        subtitle: updatedUser.subtitle,
                        mode: updatedUser.mode,
                        email: updatedUser.email,
                        isTestUser: updatedUser.is_test_user === 1,
                        webauthnUserId: updatedUser.webauthn_user_id,
                    },
                },
            });
        })
        .post("/login/start", zValidator("json", startAuthenticationSchema), async (c) => {
            // Get all credentials for conditional UI
            // We need to get credentials from all users to allow passkey autofill
            const allCredentials = queries
                .getUsers(db)
                .flatMap((user) => queries.getCredentialsByUser(db, user.id));

            // Generate authentication options
            const options = await generateAuthenticationOptions({
                rpID,
                userVerification: "preferred",
                allowCredentials: allCredentials.map((cred) => ({
                    id: Buffer.from(cred.id, "base64"),
                    transports: cred.transports || [],
                })),
            });

            // Store challenge
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

            // Get and verify challenge
            const challenge = queries.getChallengeById(db, challengeId);
            if (!challenge) {
                return c.json({ result: "error", message: "Invalid challenge" }, 400);
            }

            // Get credential by ID
            const credentialIdBase64 = Buffer.from(credential.id).toString("base64");
            const storedCredential = queries.getCredentialById(db, credentialIdBase64);
            if (!storedCredential) {
                return c.json({ result: "error", message: "Credential not found" }, 404);
            }

            // Verify authentication response
            const verification = await verifyAuthenticationResponse({
                response: credential,
                expectedChallenge: challenge.challenge,
                expectedOrigin: origin,
                expectedRPID: rpID,
                credential: {
                    id: credentialIdBase64,
                    publicKey: Buffer.from(storedCredential.publicKey, "base64"),
                    counter: storedCredential.counter,
                    transports: storedCredential.transports || [],
                },
            });

            if (!verification.verified) {
                return c.json({ result: "error", message: "Authentication failed" }, 400);
            }

            // Update credential counter
            queries.updateCredentialCounter(
                db,
                credentialIdBase64,
                verification.authenticationInfo.newCounter,
            );

            // Get user
            const user = queries.getUserById(db, storedCredential.userId);

            // Delete challenge
            queries.deleteChallenge(db, challengeId);

            // Create session
            const token = crypto.randomUUID();
            const expiresAt = new Date(Date.now() + SESSION_DURATION_MS).toISOString();
            const _session = queries.createSession(db, { userId: user.id, token, expiresAt });

            // Set session cookie
            setSessionCookie(c, token);

            return c.json({
                result: "success",
                data: {
                    user: {
                        id: user.id,
                        name: user.name,
                        initials: user.initials,
                        subtitle: user.subtitle,
                        mode: user.mode,
                        email: user.email,
                        isTestUser: user.is_test_user === 1,
                        webauthnUserId: user.webauthn_user_id,
                    },
                },
            });
        })
        .post("/quick-login", zValidator("json", quickLoginSchema), async (c) => {
            // Only allow in non-production mode
            if (process.env.NODE_ENV === "production") {
                return c.json({ result: "error", message: "Not available in production" }, 403);
            }

            const { userId } = c.req.valid("json");

            // Get user
            const user = queries.getUserById(db, userId);
            if (!user) {
                return c.json({ result: "error", message: "User not found" }, 404);
            }

            // Verify test user
            if (user.is_test_user !== 1) {
                return c.json({ result: "error", message: "Not a test user" }, 403);
            }

            // Create session
            const token = crypto.randomUUID();
            const expiresAt = new Date(Date.now() + SESSION_DURATION_MS).toISOString();
            const _session = queries.createSession(db, { userId: user.id, token, expiresAt });

            // Set session cookie
            setSessionCookie(c, token);

            return c.json({
                result: "success",
                data: {
                    user: {
                        id: user.id,
                        name: user.name,
                        initials: user.initials,
                        subtitle: user.subtitle,
                        mode: user.mode,
                        email: user.email,
                        isTestUser: user.is_test_user === 1,
                        webauthnUserId: user.webauthn_user_id,
                    },
                },
            });
        })
        .get("/me", sessionMiddleware(), async (c) => {
            const userId = c.get("userId");
            const user = queries.getUserById(db, userId);
            return c.json({
                result: "success",
                data: {
                    id: user.id,
                    name: user.name,
                    initials: user.initials,
                    subtitle: user.subtitle,
                    mode: user.mode,
                    email: user.email,
                    isTestUser: user.is_test_user === 1,
                    webauthnUserId: user.webauthn_user_id,
                },
            });
        })
        .post("/logout", sessionMiddleware(), async (c) => {
            const sessionId = c.get("sessionId");
            queries.deleteSession(db, sessionId);
            clearSessionCookie(c);
            return c.json({ result: "success" });
        })
        .get("/me", sessionMiddleware(), async (c) => {
            const userId = c.get("userId");
            const user = queries.getUserById(db, userId);
            return c.json({
                result: "success",
                data: {
                    id: user.id,
                    name: user.name,
                    initials: user.initials,
                    subtitle: user.subtitle,
                    mode: user.mode,
                    email: user.email,
                    isTestUser: user.is_test_user === 1,
                    webauthnUserId: user.webauthn_user_id,
                },
            });
        })
        .post("/logout", sessionMiddleware(), async (c) => {
            const sessionId = c.get("sessionId");
            queries.deleteSession(db, sessionId);
            clearSessionCookie(c);
            return c.json({ result: "success" });
        })
        .post(
            "/device/start",
            sessionMiddleware(),
            zValidator("json", addDeviceStartSchema),
            async (c) => {
                const userId = c.get("userId");

                const user = queries.getUserById(db, userId);
                if (!user) {
                    return c.json({ result: "error", message: "User not found" }, 404);
                }

                // Convert UUID string to Buffer for WebAuthn
                const webauthnUserIdBuffer = user.webauthnUserId
                    ? Buffer.from(user.webauthnUserId.replace(/-/g, ""), "hex")
                    : new Uint8Array(0);

                // Generate registration options
                const options = await generateRegistrationOptions({
                    rpName,
                    rpID,
                    userID: webauthnUserIdBuffer,
                    userName: user.name,
                    userDisplayName: user.name,
                    excludeCredentials: queries.getCredentialsByUser(db, userId).map((cred) => ({
                        id: cred.id,
                        transports: cred.transports || [],
                    })),
                    authenticatorSelection: {
                        authenticatorAttachment: "cross-platform",
                        userVerification: "preferred",
                    },
                });

                // Store challenge
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
                const { credential, challengeId } = c.req.valid("json");
                const userId = c.get("userId");

                // Get and verify challenge
                const challenge = queries.getChallengeById(db, challengeId);
                if (!challenge) {
                    return c.json({ result: "error", message: "Invalid challenge" }, 400);
                }

                // Verify registration response
                const verification = await verifyRegistrationResponse({
                    response: credential,
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

                // Store credential
                const credentialIdBase64 = Buffer.from(credentialID).toString("base64");
                const publicKeyBase64 = Buffer.from(credentialPublicKey).toString("base64");
                queries.createCredential(db, {
                    id: credentialIdBase64,
                    userId,
                    publicKey: publicKeyBase64,
                    counter,
                    deviceType: credentialDeviceType,
                    backedUp: credentialBackedUp,
                    transports: credential.transports || [],
                    aaguid: verification.registrationInfo?.aaguid || "",
                });

                // Delete challenge
                queries.deleteChallenge(db, challengeId);

                return c.json({ result: "success" });
            },
        )
        .delete(
            "/device/:credentialId",
            sessionMiddleware(),
            zValidator("param", z.object({ credentialId: z.string() })),
            async (c) => {
                const { credentialId } = c.req.valid("param");
                const userId = c.get("userId");

                // Get credential
                const credential = queries.getCredentialById(db, credentialId);
                if (!credential) {
                    return c.json({ result: "error", message: "Credential not found" }, 404);
                }

                // Check ownership
                if (credential.userId !== userId) {
                    return c.json({ result: "error", message: "Unauthorized" }, 403);
                }

                // Check if it's the last credential
                const userCredentials = queries.getCredentialsByUser(db, userId);
                if (userCredentials.length <= 1) {
                    return c.json(
                        { result: "error", message: "Cannot remove last credential" },
                        400,
                    );
                }

                // Delete credential
                queries.deleteCredential(db, credentialId);

                return c.json({ result: "success" });
            },
        )
        .get("/devices", sessionMiddleware(), async (c) => {
            const userId = c.get("userId");
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

// Default export for production
const auth = createAuthRouter();
export { auth as authRouter };
