// Mock @simplewebauthn/browser for Bun test environment
// This file is loaded by client test files that need WebAuthn functionality

export const startRegistration = async () => {
    throw new Error("WebAuthn not available in test environment");
};

export const startAuthentication = async () => {
    throw new Error("WebAuthn not available in test environment");
};
