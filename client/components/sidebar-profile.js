import { LitElement } from "lit-element";
import { html } from "lit-html";
import { customElement } from "lit/decorators.js";

class SidebarProfile extends LitElement {
    static properties = {
        name: { type: String },
        subtitle: { type: String },
        initials: { type: String },
    };

    createRenderRoot() {
        return this;
    }

    constructor() {
        super();
        /** @type {string} */
        this.name = "";
        /** @type {string} */
        this.subtitle = "";
        /** @type {string} */
        this.initials = "";
    }

    render() {
        return html`
            <div class="border-t border-border pt-4 flex items-center gap-3">
                <div
                    class="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-xs font-bold"
                >
                    ${this.initials}
                </div>
                <div>
                    <p class="text-sm font-medium leading-none">${this.name}</p>
                    <p class="text-xs text-muted-foreground mt-1">${this.subtitle}</p>
                </div>
            </div>
        `;
    }
}

const element = customElement("sidebar-profile")(SidebarProfile);
export { element as SidebarProfile };
