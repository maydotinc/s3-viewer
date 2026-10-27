// AbortSignal.any is missing before Safari 17.4, Chrome 116 and Firefox 124
const anySignal = (signals: AbortSignal[]): AbortSignal => {
   if (typeof AbortSignal.any === "function") return AbortSignal.any(signals);
   const controller = new AbortController();
   const already = signals.find((signal) => signal.aborted);
   if (already) {
      controller.abort(already.reason);
      return controller.signal;
   }
   const cleanup = () => {
      for (const signal of signals)
         signal.removeEventListener("abort", onAbort);
   };
   function onAbort(this: AbortSignal) {
      cleanup();
      controller.abort(this.reason);
   }
   for (const signal of signals) signal.addEventListener("abort", onAbort);
   return controller.signal;
};

export { anySignal };
