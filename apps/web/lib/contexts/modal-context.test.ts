import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as React from "react";

type Session = { userId: string | null; serverId: string };
const h = vi.hoisted(() => ({
   session: { userId: "user-a", serverId: "server-a" } as Session,
   state: undefined as unknown,
   initialized: false,
   effects: [] as (() => void | (() => void))[],
}));

vi.mock("react", async (original) => ({
   ...(await original<typeof React>()),
   useState: (initial: unknown) => {
      if (!h.initialized) {
         h.state = typeof initial === "function" ? initial() : initial;
         h.initialized = true;
      }
      return [
         h.state,
         (next: unknown) => {
            h.state = typeof next === "function" ? next(h.state) : next;
         },
      ];
   },
   useEffect: (effect: () => void | (() => void)) => {
      h.effects.push(effect);
   },
   useCallback: (callback: unknown) => callback,
   useMemo: (factory: () => unknown) => factory(),
}));
vi.mock("@/lib/stores/session-store", () => ({
   default: Object.assign(
      (selector: (session: Session) => unknown) => selector(h.session),
      { getState: () => h.session }
   ),
}));

import { ModalProvider, useModalActions, useModalState } from "./modal-context";

type Actions = ReturnType<typeof useModalActions>;
type Modals = ReturnType<typeof useModalState>;
type ProviderTree = React.ReactElement<{
   value: Actions;
   children: React.ReactElement<{ value: Modals }>;
}>;

const render = () => {
   h.effects = [];
   const tree = ModalProvider({ children: null }) as ProviderTree;
   return {
      actions: tree.props.value,
      modals: tree.props.children.props.value,
   };
};
const flushEffects = () => {
   for (const effect of h.effects) effect();
};
const openObjects = () => {
   const { actions } = render();
   actions.openScoped("confirmDelete", {
      serverId: "server-a",
      bucketName: "backups",
      objects: [{ key: "important.txt", expectedETag: '"original"' }],
   });
   actions.openScoped("renameObject", {
      serverId: "server-a",
      bucketName: "backups",
      objectKey: "important.txt",
      expectedETag: '"original"',
   });
   actions.openScoped("copyObject", {
      serverId: "server-a",
      bucketName: "backups",
      objectKey: "important.txt",
      expectedETag: '"original"',
   });
   actions.openScoped("createFolder", {
      serverId: "server-a",
      bucketName: "backups",
      prefix: "reports/",
   });
   actions.openScoped("moveObjects", {
      serverId: "server-a",
      bucketName: "backups",
      source: { folderKey: "reports/" },
   });
   actions.openScoped("transferObjects", {
      serverId: "server-a",
      bucketName: "backups",
      source: { folderKey: "reports/" },
   });
   actions.openScoped("objectSettings", {
      serverId: "server-a",
      bucketName: "backups",
      objectKey: "important.txt",
      expectedETag: '"original"',
   });
   actions.openScoped("bulkRename", {
      serverId: "server-a",
      bucketName: "backups",
      source: { folderKey: "reports/" },
   });
   actions.openScoped("incompleteUploads", {
      serverId: "server-a",
      bucketName: "backups",
      prefix: "reports/",
   });
   return render();
};

beforeEach(() => {
   h.session = { userId: "user-a", serverId: "server-a" };
   h.initialized = false;
   h.effects = [];
   vi.stubGlobal("document", { body: { style: { overflow: "" } } });
});
afterEach(() => vi.unstubAllGlobals());

describe("modal lifetime follows its opening session and server", () => {
   it("captures user identity when destructive dialogs open", () => {
      const { modals } = openObjects();
      expect(modals.confirmDelete).toMatchObject({
         userId: "user-a",
         serverId: "server-a",
      });
      expect(modals.renameObject).toMatchObject({
         userId: "user-a",
         serverId: "server-a",
         expectedETag: '"original"',
      });
      expect(modals.copyObject).toMatchObject({
         userId: "user-a",
         expectedETag: '"original"',
      });
      expect(modals.createFolder).toMatchObject({
         userId: "user-a",
         prefix: "reports/",
      });
      expect(modals.moveObjects).toMatchObject({
         userId: "user-a",
         source: { folderKey: "reports/" },
      });
      expect(modals.transferObjects).toMatchObject({
         userId: "user-a",
         serverId: "server-a",
         source: { folderKey: "reports/" },
      });
      expect(modals.objectSettings).toMatchObject({
         userId: "user-a",
         objectKey: "important.txt",
         expectedETag: '"original"',
      });
      expect(modals.bulkRename).toMatchObject({
         userId: "user-a",
         source: { folderKey: "reports/" },
      });
      expect(modals.incompleteUploads).toMatchObject({
         userId: "user-a",
         prefix: "reports/",
      });
   });

   it.each([
      { userId: "user-a", serverId: "server-b" },
      { userId: "user-b", serverId: "server-a" },
      { userId: null, serverId: "server-a" },
   ])(
      "immediately hides stale dialogs after the scope becomes %j",
      (session) => {
         openObjects();
         h.session = session;
         expect(render().modals).toEqual({});
         flushEffects();
         h.session = { userId: "user-a", serverId: "server-a" };
         expect(render().modals).toEqual({});
      }
   );

   it("rejects callbacks from stale rows after switching servers", () => {
      const { actions } = render();
      h.session.serverId = "server-b";
      actions.openScoped("confirmDelete", {
         serverId: "server-a",
         bucketName: "backups",
         objects: [{ key: "important.txt", expectedETag: '"original"' }],
      });
      actions.openScoped("renameObject", {
         serverId: "server-a",
         bucketName: "backups",
         objectKey: "important.txt",
         expectedETag: '"original"',
      });
      actions.openScoped("copyObject", {
         serverId: "server-a",
         bucketName: "backups",
         objectKey: "important.txt",
         expectedETag: '"original"',
      });
      actions.openScoped("createFolder", {
         serverId: "server-a",
         bucketName: "backups",
         prefix: "reports/",
      });
      actions.openScoped("moveObjects", {
         serverId: "server-a",
         bucketName: "backups",
         source: { objects: [], prefix: "reports/" },
      });
      actions.openScoped("transferObjects", {
         serverId: "server-a",
         bucketName: "backups",
         source: { objects: [], prefix: "reports/" },
      });
      actions.openScoped("objectSettings", {
         serverId: "server-a",
         bucketName: "backups",
         objectKey: "important.txt",
         expectedETag: '"original"',
      });
      actions.openScoped("bulkRename", {
         serverId: "server-a",
         bucketName: "backups",
         source: { objects: [] },
      });
      actions.openScoped("incompleteUploads", {
         serverId: "server-a",
         bucketName: "backups",
         prefix: "reports/",
      });
      expect(render().modals).toEqual({});
   });
});
