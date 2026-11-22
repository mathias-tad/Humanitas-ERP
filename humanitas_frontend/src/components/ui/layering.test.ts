/// <reference types="node" />
import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";

/**
 * Layering (AGENTS.md rule 24 item 26): pop-ups opened inside a dialog or drawer (pickers, selects,
 * menus, tooltips) must show above it, and a confirmation above the dialog that opened it.
 * Guards the bug where the product picker opened under the price list rule dialog.
 */
const ui = (name: string) => readFileSync(join(process.cwd(), "src/components/ui", name), "utf8");
const zs = (src: string) => [...src.matchAll(/(?<![\w-])z-(?:\[(\d+)\]|(\d+))(?![\w\]])/g)].map((m) => Number(m[1] ?? m[2]));
const top = (name: string) => Math.max(...zs(ui(name)));
const lowestLayer = (name: string) => Math.min(...zs(ui(name)).filter((z) => z >= 50));

describe("UI layering", () => {
  const overlays = Math.max(top("dialog.tsx"), top("sheet.tsx"));

  it.each(["popover.tsx", "select.tsx", "dropdown-menu.tsx", "tooltip.tsx"])("%s opens above dialogs and drawers", (file) => {
    expect(lowestLayer(file)).toBeGreaterThan(overlays);
  });

  it("puts confirmations above the dialog that opened them", () => {
    expect(lowestLayer("alert-dialog.tsx")).toBeGreaterThan(top("dialog.tsx"));
  });
});
