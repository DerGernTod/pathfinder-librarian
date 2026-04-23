import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { mock } from "bun:test";

GlobalRegistrator.register();

const components = [
    "card/card",
    "details/details",
    "input/input",
    "spinner/spinner",
    "textarea/textarea",
];

for (const comp of components) {
    mock.module(
        `https://esm.sh/@shoelace-style/shoelace@2.20.1/dist/components/${comp}.js?deps=lit@3.3.2`,
        () => import(`@shoelace-style/shoelace/dist/components/${comp}.js`),
    );
}
