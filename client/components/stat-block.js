import "https://esm.sh/@shoelace-style/shoelace@2.20.1/dist/components/card/card.js?deps=lit@3.3.2";
import "https://esm.sh/@shoelace-style/shoelace@2.20.1/dist/components/details/details.js?deps=lit@3.3.2";
import { LitElement } from "lit-element";
import { html } from "lit-html";
import { customElement } from "lit/decorators.js";

class StatBlock extends LitElement {
    static properties = {
        title: { type: String },
        data: { type: Object },
    };

    createRenderRoot() {
        return this;
    }

    constructor() {
        super();
        this.title = "";
        this.data = {};
    }

    render() {
        return html`
            <sl-details summary="View ${this.title} Stat Block" class="mt-4">
                <sl-card class="w-full">
                    <pre class="font-mono text-xs text-green-400 overflow-x-auto">
${JSON.stringify(this.data, null, 2)}</pre
                    >
                </sl-card>
            </sl-details>
        `;
    }
}

const element = customElement("stat-block")(StatBlock);
export { element as StatBlock };
