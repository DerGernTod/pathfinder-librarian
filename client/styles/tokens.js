import { css } from "lit-element";

export const tokens = css`
    :host {
        --background: hsl(240, 10%, 3.9%);
        --foreground: hsl(0, 0%, 98%);
        --border: hsl(240, 3.7%, 15.9%);
        --border-lighter: hsl(240, 3.7%, 25%);
        --secondary: hsl(240, 3.7%, 15.9%);
        --secondary-foreground: hsl(240, 5%, 96.1%);
        --muted: hsl(240, 3.7%, 15.9%);
        --muted-foreground: hsl(240, 5%, 64.9%);
        --card: hsl(240, 10%, 3.9%);
        --card-foreground: hsl(0, 0%, 98%);
        --transition-speed: 200ms;
        --accent-transition-speed: 500ms;
        --border-radius: 4px;
        --accent-gm: hsl(262, 83%, 58%);
        --accent-player: hsl(25, 83%, 48%);
    }
`;
