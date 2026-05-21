import { GlobalRegistrator } from "@happy-dom/global-registrator";

const NativeTransformStream = globalThis.TransformStream;
const NativeWritableStream = globalThis.WritableStream;
const NativeReadableStream = globalThis.ReadableStream;

GlobalRegistrator.register();

globalThis.TransformStream = NativeTransformStream;
globalThis.WritableStream = NativeWritableStream;
globalThis.ReadableStream = NativeReadableStream;
