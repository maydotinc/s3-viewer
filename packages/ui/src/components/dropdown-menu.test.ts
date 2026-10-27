// @vitest-environment happy-dom
import { act, createElement, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Dialog, DialogContent, DialogTitle } from "./dialog";
import {
   DropdownMenu,
   DropdownMenuContent,
   DropdownMenuItem,
   DropdownMenuTrigger,
} from "./dropdown-menu";

let container: HTMLDivElement;
let root: Root;

const Harness = () => {
   const [dialog, setDialog] = useState(false);
   const [nested, setNested] = useState(false);
   return createElement(
      "div",
      null,
      createElement(
         DropdownMenu,
         null,
         createElement(DropdownMenuTrigger, null, "Actions"),
         createElement(
            DropdownMenuContent,
            null,
            createElement(DropdownMenuItem, null, "Copy"),
            createElement(
               DropdownMenuItem,
               { onSelect: () => setDialog(true) },
               "Rename"
            )
         )
      ),
      dialog &&
         createElement(
            Dialog,
            { open: true, onOpenChange: () => setDialog(false) },
            createElement(
               DialogContent,
               { "aria-describedby": undefined },
               createElement(DialogTitle, null, "Rename"),
               createElement("input", { "aria-label": "Name" }),
               createElement(
                  "button",
                  { type: "button", onClick: () => setNested(true) },
                  "Details"
               )
            )
         ),
      nested &&
         createElement(
            Dialog,
            { open: true, onOpenChange: () => setNested(false) },
            createElement(
               DialogContent,
               { "aria-describedby": undefined },
               createElement(DialogTitle, null, "Details")
            )
         )
   );
};

const settle = () =>
   act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
   });
const trigger = () =>
   [...document.querySelectorAll("button")].find(
      (button) => button.textContent === "Actions"
   )!;
const openMenu = async () => {
   trigger().focus();
   await act(async () => {
      trigger().dispatchEvent(
         new KeyboardEvent("keydown", { key: "Enter", bubbles: true })
      );
   });
   await settle();
};
const button = (label: string) =>
   [...document.querySelectorAll("button")].find(
      (element) => element.textContent === label
   )!;
const dialogs = () => [...document.querySelectorAll('[role="dialog"]')];
const escape = async (dialog: Element) => {
   await act(async () => {
      dialog.dispatchEvent(
         new KeyboardEvent("keydown", { key: "Escape", bubbles: true })
      );
   });
   await settle();
};
const pick = async (label: string) => {
   const item = [...document.querySelectorAll('[role="menuitem"]')].find(
      (element) => element.textContent === label
   ) as HTMLElement;
   await act(async () => item.click());
   await settle();
};

beforeEach(async () => {
   vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
   container = document.createElement("div");
   document.body.append(container);
   root = createRoot(container);
   await act(async () => root.render(createElement(Harness)));
});

afterEach(async () => {
   await act(async () => root.unmount());
   container.remove();
   vi.unstubAllGlobals();
});

describe("menu focus", () => {
   it("returns focus to the trigger after a plain pick", async () => {
      await openMenu();
      expect(document.querySelector('[role="menu"]')).not.toBeNull();
      await pick("Copy");
      expect(document.querySelector('[role="menu"]')).toBeNull();
      expect(document.activeElement).toBe(trigger());
   });

   it("leaves focus in a dialog the item opened, then returns it to the trigger", async () => {
      await openMenu();
      await pick("Rename");
      const dialog = document.querySelector('[role="dialog"]')!;
      expect(dialog.contains(document.activeElement)).toBe(true);
      await escape(dialog);
      expect(document.querySelector('[role="dialog"]')).toBeNull();
      expect(document.activeElement).toBe(trigger());
   });

   it("returns focus inside the outer dialog when a nested one closes, then to the trigger", async () => {
      await openMenu();
      await pick("Rename");
      button("Details").focus();
      await act(async () => button("Details").click());
      await settle();
      expect(dialogs()).toHaveLength(2);
      await escape(dialogs()[1]!);
      expect(dialogs()).toHaveLength(1);
      expect(document.activeElement).toBe(button("Details"));
      await escape(dialogs()[0]!);
      expect(dialogs()).toHaveLength(0);
      expect(document.activeElement).toBe(trigger());
   });
});
