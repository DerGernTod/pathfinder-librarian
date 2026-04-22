import "https://esm.sh/@shoelace-style/shoelace?deps=lit@3.3.2/dist/components/button/button.js";
import { LitElement, css } from "lit-element";
import { customElement } from "lit/decorators.js";
import { html } from "lit-html";

class MainPage extends LitElement {
    static styles = css`
        :host {
            padding: 1rem;
            font-weight: 600;
            font-size: 2em;
            font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;

            height: 100vh;
            width: 50vw;
            margin: 0;
            padding: 0;
        }
    `;
    render() {
        return html`
            <h1>Welcome to Pathfinder Librarian!</h1>
            <p>This is the main page.</p>
            <sl-button @click=${() => alert("Hello from Shoelace!")}>Click me</sl-button>
        `;
    }
}

const element = customElement("main-page")(MainPage);
export { element as MainPage };