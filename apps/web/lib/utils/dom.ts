const TOOLBAR_DEPTH = 4;

const isTypingTarget = (target: EventTarget | null): boolean => {
   if (!(target instanceof HTMLElement)) return false;
   if (target.isContentEditable) return true;
   const tag = target.tagName;
   if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
   return target.closest("[role=combobox]") !== null;
};

const focusToolbarFilter = (from: HTMLElement | null): void => {
   let scope = from?.parentElement ?? null;
   for (let depth = 0; scope && depth < TOOLBAR_DEPTH; depth += 1) {
      const input = scope.querySelector<HTMLInputElement>('input[type="text"]');
      if (input) {
         input.focus();
         input.select();
         return;
      }
      scope = scope.parentElement;
   }
};

export { focusToolbarFilter, isTypingTarget };
