import { mock } from "bun:test";

delete process.env.GOOGLE_AI_API_KEY;

const components = [
    "card/card",
    "details/details",
    "input/input",
    "spinner/spinner",
    "textarea/textarea",
    "icon-button/icon-button",
    "menu/menu",
    "menu-item/menu-item",
    "dropdown/dropdown",
    "tag/tag",
    "divider/divider",
    "tooltip/tooltip",
    "dialog/dialog",
    "button/button",
    "radio-group/radio-group",
    "radio-button/radio-button",
];

for (const comp of components) {
    await mock.module(
        `https://esm.sh/@shoelace-style/shoelace@2.20.1/dist/components/${comp}.js?deps=lit@3.3.2`,
        () => import(`@shoelace-style/shoelace/dist/components/${comp}.js`),
    );
}

// Mock @simplewebauthn/browser module for client-side tests
await mock.module("https://esm.sh/@simplewebauthn/browser@10.0.0", () => ({
    startRegistration: async (/** @type {unknown} */ _options) => ({
        id: "mock-credential-id",
        rawId: "mock-raw-id",
        response: {
            clientDataJSON: "mock-client-data",
            attestationObject: "mock-attestation",
        },
        getType: () => "public-key",
        toJSON: () => ({
            id: "mock-credential-id",
            rawId: "mock-raw-id",
            response: {
                clientDataJSON: "mock-client-data",
                attestationObject: "mock-attestation",
            },
            type: "public-key",
        }),
    }),
    startAuthentication: async (/** @type {unknown} */ _options) => ({
        id: "mock-credential-id",
        rawId: "mock-raw-id",
        response: {
            clientDataJSON: "mock-client-data",
            authenticatorData: "mock-authenticator-data",
            signature: "mock-signature",
            userHandle: null,
        },
        getType: () => "public-key",
        toJSON: () => ({
            id: "mock-credential-id",
            rawId: "mock-raw-id",
            response: {
                clientDataJSON: "mock-client-data",
                authenticatorData: "mock-authenticator-data",
                signature: "mock-signature",
                userHandle: null,
            },
            type: "public-key",
        }),
    }),
    browserSupportsWebAuthn: () => true,
}));
