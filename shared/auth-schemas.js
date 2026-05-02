import { z } from "zod";

/** Schema for starting passkey registration */
export const startRegistrationSchema = z.object({
    name: z.string().min(1).max(100),
});

export const registrationResponseSchema = z.object({
    clientDataJSON: z.string(),
    attestationObject: z.string(),
    authenticatorData: z.string().optional(),
    transports: z.array(z.string()).optional(),
    publicKeyAlgorithm: z.number().optional(),
    publicKey: z.string().optional(),
});

const clientExtensionResultsSchema = z.object({
    appid: z.boolean().optional(),
    credProps: z.object({ rk: z.boolean().optional() }).optional(),
    hmacCreateSecret: z.boolean().optional(),
});

const credentialSchema = z.object({
    id: z.string(),
    rawId: z.string(),
    response: registrationResponseSchema,
    clientExtensionResults: clientExtensionResultsSchema,
    type: z.literal("public-key"),
    authenticatorAttachment: z.string().optional(),
});

export const finishRegistrationSchema = z.object({
    credential: credentialSchema,
    challengeId: z.uuid(),
    webauthnUserId: z.uuid().optional(),
});

export const authResponseSchema = z.object({
    clientDataJSON: z.string(),
    authenticatorData: z.string(),
    signature: z.string(),
    userHandle: z.string().optional(),
});

export const finishAuthenticationSchema = z.object({
    credential: z.object({
        id: z.string(),
        rawId: z.string(),
        response: authResponseSchema,
        clientExtensionResults: clientExtensionResultsSchema,
        type: z.string(),
    }),
    challengeId: z.uuid(),
});

/** Schema for starting passkey authentication */
export const startAuthenticationSchema = z.object({});

/** Schema for dev-only quick login */
export const quickLoginSchema = z.object({
    userId: z.string().uuid(),
});

/** Schema for adding a device from settings (requires existing session) */
export const addDeviceStartSchema = z.object({});

/** Schema for one-time key device registration */
export const oneTimeKeySchema = z.object({
    key: z.string().min(1),
});
