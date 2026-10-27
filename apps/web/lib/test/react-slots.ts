import type * as React from "react";

type SlotState = { slots: unknown[]; cursor: number };

// hooks keep their values in h.slots by call order, so a test can call the component as a function
const reactSlotsMock = (react: typeof React, h: SlotState) => ({
   ...react,
   useState: (initial: unknown) => {
      const index = h.cursor++;
      if (!(index in h.slots)) h.slots[index] = initial;
      return [
         h.slots[index],
         (value: unknown) => {
            h.slots[index] =
               typeof value === "function"
                  ? (value as (previous: unknown) => unknown)(h.slots[index])
                  : value;
         },
      ];
   },
   useRef: (current: unknown) => {
      const index = h.cursor++;
      return (h.slots[index] ??= { current });
   },
   useMemo: (factory: () => unknown) => {
      const index = h.cursor++;
      if (!(index in h.slots)) h.slots[index] = factory();
      return h.slots[index];
   },
   useEffect: () => undefined,
});

export { reactSlotsMock };
