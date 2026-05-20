declare module "https://esm.sh/@shoelace-style/shoelace*";

declare module "marked" {
    export const marked: {
        parse(md: string, options?: { breaks?: boolean; gfm?: boolean }): string;
    };
}

declare module "@lit/context" {
    export function createContext<ValueType>(key: string): {
        __context__: unique symbol;
        __value__: ValueType;
    };

    export class ContextProvider<ValueType> {
        constructor(host: HTMLElement, options: { context: unknown; initialValue: ValueType });
        setValue(value: ValueType): void;
    }

    export class ContextConsumer<ValueType> {
        constructor(
            host: HTMLElement,
            options: {
                context: unknown;
                callback: (value: ValueType) => void;
                subscribe?: boolean;
            },
        );
    }
}
