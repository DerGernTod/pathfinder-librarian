import { z } from "zod";

/** Schema for starting passkey registration */
export const startRegistrationSchema = z.object({
    name: z.string().min(1).max(100),
});

/** Schema for finishing passkey registration (client sends credential payload) */
export const finishRegistrationSchema = z.object({
    credential: z.object({}).passthrough(),
    challengeId: z.string().uuid(),
});

/** Schema for starting passkey authentication */
export const startAuthenticationSchema = z.object({});

/** Schema for finishing passkey authentication */
export const finishAuthenticationSchema = z.object({
    credential: z.object({}).passthrough(),
    challengeId: z.string().uuid(),
});

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
