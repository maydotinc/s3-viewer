const DIALOG = '[role="dialog"], [role="alertdialog"]';

// a menu item or command that opens a dialog closes its own layer once that dialog has mounted, so the closing
// layer hands its focus target over here and the dialog returns focus to it when it closes
let handed: HTMLElement | null = null;

const dialogCovers = (target: Element): boolean =>
   [...document.querySelectorAll(DIALOG)].some(
      (dialog) => !dialog.contains(target)
   );

const withinDialog = (target: Element): boolean =>
   target.closest(DIALOG) !== null;

const handFocusToDialog = (target: HTMLElement): void => {
   handed = target;
};

const takeHandedFocus = (): HTMLElement | null => {
   const target = handed;
   handed = null;
   return target?.isConnected ? target : null;
};

const returnFocus = (target: HTMLElement): void => {
   if (dialogCovers(target)) handFocusToDialog(target);
   else target.focus();
};

export {
   dialogCovers,
   handFocusToDialog,
   returnFocus,
   takeHandedFocus,
   withinDialog,
};
