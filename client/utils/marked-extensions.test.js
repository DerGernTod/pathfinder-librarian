import { describe, expect, it } from "bun:test";

import { marked } from "marked";

import { escapeAttr, escapeHtml } from "./marked-extensions.js";

describe("marked-extensions", () => {
    describe("escapeHtml", () => {
        it("escapes ampersands", () => {
            expect(escapeHtml("a&b")).toBe("a&amp;b");
        });

        it("escapes less-than signs", () => {
            expect(escapeHtml("a<b")).toBe("a&lt;b");
        });

        it("escapes greater-than signs", () => {
            expect(escapeHtml("a>b")).toBe("a&gt;b");
        });

        it("escapes all three special characters together", () => {
            expect(escapeHtml("<&>")).toBe("&lt;&amp;&gt;");
        });

        it("returns plain text unchanged", () => {
            expect(escapeHtml("hello world")).toBe("hello world");
        });
    });

    describe("escapeAttr", () => {
        it("escapes double quotes", () => {
            expect(escapeAttr('a"b')).toBe("a&quot;b");
        });

        it("escapes single quotes", () => {
            expect(escapeAttr("a'b")).toBe("a&#39;b");
        });

        it("escapes all five special characters", () => {
            expect(escapeAttr(`<&>"'`)).toBe("&lt;&amp;&gt;&quot;&#39;");
        });

        it("returns plain text unchanged", () => {
            expect(escapeAttr("hello world")).toBe("hello world");
        });
    });

    describe("dice extension", () => {
        it("tokenizes :dice{2d6 fire} and renders a badge", () => {
            const result = marked.parse("Roll :dice{2d6 fire} damage.", {
                breaks: true,
                gfm: true,
            });
            expect(result).toContain('class="dice-badge"');
            expect(result).toContain('data-formula="2d6 fire"');
            expect(result).toContain(">2d6 fire</span>");
        });

        it("tokenizes :dice{1d20+5}", () => {
            const result = marked.parse("Check :dice{1d20+5}.", { breaks: true, gfm: true });
            expect(result).toContain('data-formula="1d20+5"');
            expect(result).toContain(">1d20+5</span>");
        });

        it("does NOT match plain 2d6 without wrapper", () => {
            const result = marked.parse("Roll 2d6 damage.", { breaks: true, gfm: true });
            expect(result).not.toContain("dice-badge");
        });

        it("escapes special characters in formula", () => {
            const result = marked.parse("Roll :dice{2d6<fire>}.", { breaks: true, gfm: true });
            expect(result).toContain('data-formula="2d6&lt;fire&gt;"');
            expect(result).toContain(">2d6&lt;fire&gt;</span>");
        });

        it("does NOT match empty braces :dice{}", () => {
            const result = marked.parse("Roll :dice{} now.", { breaks: true, gfm: true });
            expect(result).not.toContain("dice-badge");
        });
    });

    describe("dc extension", () => {
        it("tokenizes :dc{15} and renders with DC prefix", () => {
            const result = marked.parse("Succeed at :dc{15}.", { breaks: true, gfm: true });
            expect(result).toContain('class="dc-badge"');
            expect(result).toContain(">DC 15</span>");
        });

        it("tokenizes :dc{25 Fortitude} with label", () => {
            const result = marked.parse("Make a :dc{25 Fortitude} save.", {
                breaks: true,
                gfm: true,
            });
            expect(result).toContain(">DC 25 Fortitude</span>");
        });

        it("escapes special characters in value", () => {
            const result = marked.parse("Make a :dc{15&more}.", { breaks: true, gfm: true });
            expect(result).toContain(">DC 15&amp;more</span>");
        });

        it("does NOT match empty braces :dc{}", () => {
            const result = marked.parse("Try :dc{} now.", { breaks: true, gfm: true });
            expect(result).not.toContain("dc-badge");
        });
    });

    describe("condition extension", () => {
        it("tokenizes :condition{Stunned} and renders a badge", () => {
            const result = marked.parse("Target is :condition{Stunned}.", {
                breaks: true,
                gfm: true,
            });
            expect(result).toContain('class="condition-badge"');
            expect(result).toContain(">Stunned</span>");
        });

        it("tokenizes :condition{Enfeebled 2} with value", () => {
            const result = marked.parse("You become :condition{Enfeebled 2}.", {
                breaks: true,
                gfm: true,
            });
            expect(result).toContain(">Enfeebled 2</span>");
        });

        it("escapes special characters in name", () => {
            const result = marked.parse("You become :condition{Bad&Stuff}.", {
                breaks: true,
                gfm: true,
            });
            expect(result).toContain(">Bad&amp;Stuff</span>");
        });
    });

    describe("trait extension", () => {
        it("tokenizes :trait{Dragon} and renders a badge", () => {
            const result = marked.parse("Has :trait{Dragon} trait.", { breaks: true, gfm: true });
            expect(result).toContain('class="trait-badge"');
            expect(result).toContain(">Dragon</span>");
        });

        it("tokenizes :trait{Fire}", () => {
            const result = marked.parse("Also :trait{Fire}.", { breaks: true, gfm: true });
            expect(result).toContain(">Fire</span>");
        });

        it("escapes special characters in name", () => {
            const result = marked.parse("Has :trait{Bug's<Bug>} trait.", {
                breaks: true,
                gfm: true,
            });
            expect(result).toContain(">Bug's&lt;Bug&gt;</span>");
        });
    });

    describe("action extension", () => {
        it("renders :action{1} as single action symbol", () => {
            const result = marked.parse("Costs :action{1}.", { breaks: true, gfm: true });
            expect(result).toContain('class="action-icon"');
            expect(result).toContain('data-actions="1"');
            expect(result).toContain(">\u2B24</span>");
        });

        it("renders :action{2} as double action symbol", () => {
            const result = marked.parse("Costs :action{2}.", { breaks: true, gfm: true });
            expect(result).toContain(">\u2B24\u2B24</span>");
        });

        it("renders :action{3} as triple action symbol", () => {
            const result = marked.parse("Costs :action{3}.", { breaks: true, gfm: true });
            expect(result).toContain(">\u2B24\u2B24\u2B24</span>");
        });

        it("renders :action{reaction} as reaction symbol", () => {
            const result = marked.parse("Use :action{reaction}.", { breaks: true, gfm: true });
            expect(result).toContain(">\u27F3</span>");
        });

        it("renders :action{free} as free action symbol", () => {
            const result = marked.parse("Use :action{free}.", { breaks: true, gfm: true });
            expect(result).toContain(">\u25C7</span>");
        });

        it("renders unknown action types as-is", () => {
            const result = marked.parse("Use :action{custom}.", { breaks: true, gfm: true });
            expect(result).toContain(">custom</span>");
        });

        it("escapes data-actions attribute", () => {
            const result = marked.parse("Use :action{1}.", { breaks: true, gfm: true });
            expect(result).toContain('data-actions="1"');
        });
    });

    describe("integration", () => {
        it("renders multiple badge types on one line", () => {
            const md =
                "Deal :dice{2d6 fire} on a failed :dc{15} save, causing :condition{Stunned 1}. Has :trait{Dragon} and costs :action{2}.";
            const result = marked.parse(md, { breaks: true, gfm: true });
            expect(result).toContain("dice-badge");
            expect(result).toContain("dc-badge");
            expect(result).toContain("condition-badge");
            expect(result).toContain("trait-badge");
            expect(result).toContain("action-icon");
        });

        it("renders badges inside markdown lists", () => {
            const md =
                "- Roll :dice{1d20+5} for the check\n- DC is :dc{20}\n- On fail: :condition{Stunned 1}";
            const result = marked.parse(md, { breaks: true, gfm: true });
            expect(result).toContain("dice-badge");
            expect(result).toContain("dc-badge");
            expect(result).toContain("condition-badge");
        });

        it("renders badges alongside standard markdown formatting", () => {
            const md = "You deal **:dice{2d6 fire}** damage with a :trait{Fire} weapon.";
            const result = marked.parse(md, { breaks: true, gfm: true });
            expect(result).toContain("dice-badge");
            expect(result).toContain("trait-badge");
            expect(result).toContain("<strong>");
        });
    });

    describe("malformed syntax rejection", () => {
        it("rejects :dice{2d6 without closing brace", () => {
            const result = marked.parse("Roll :dice{2d6 now.", { breaks: true, gfm: true });
            expect(result).not.toContain("dice-badge");
        });

        it("rejects :dice 2d6 without braces", () => {
            const result = marked.parse("Roll :dice 2d6 now.", { breaks: true, gfm: true });
            expect(result).not.toContain("dice-badge");
        });

        it("rejects :dice{ empty braces", () => {
            const result = marked.parse("Roll :dice{} now.", { breaks: true, gfm: true });
            expect(result).not.toContain("dice-badge");
        });

        it("rejects :dc without braces", () => {
            const result = marked.parse("Check :dc 15.", { breaks: true, gfm: true });
            expect(result).not.toContain("dc-badge");
        });

        it("rejects :condition without braces", () => {
            const result = marked.parse("Apply :condition Stunned.", { breaks: true, gfm: true });
            expect(result).not.toContain("condition-badge");
        });
    });

    describe("XSS prevention", () => {
        it("escapes HTML in dice formula text content", () => {
            const result = marked.parse("Roll :dice{<script>alert(1)</script>}.", {
                breaks: true,
                gfm: true,
            });
            expect(result).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
            expect(result).not.toContain("<script>");
        });

        it("escapes HTML in dice formula attribute", () => {
            const result = marked.parse('Roll :dice{"onclick="evil}.', {
                breaks: true,
                gfm: true,
            });
            expect(result).toContain("&quot;onclick=&quot;evil");
        });

        it("escapes HTML in condition name", () => {
            const result = marked.parse("Apply :condition{<img onerror=evil>}.", {
                breaks: true,
                gfm: true,
            });
            expect(result).toContain("&lt;img onerror=evil&gt;");
            expect(result).not.toContain("<img");
        });

        it("escapes HTML in trait name", () => {
            const result = marked.parse("Has :trait{<script>x</script>} trait.", {
                breaks: true,
                gfm: true,
            });
            expect(result).not.toContain("<script>");
        });
    });
});
