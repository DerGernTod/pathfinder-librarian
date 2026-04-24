import { mock } from "bun:test";

import { GlobalRegistrator } from "@happy-dom/global-registrator";

GlobalRegistrator.register();

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
];

for (const comp of components) {
    mock.module(
        `https://esm.sh/@shoelace-style/shoelace@2.20.1/dist/components/${comp}.js?deps=lit@3.3.2`,
        () => import(`@shoelace-style/shoelace/dist/components/${comp}.js`),
    );
}
