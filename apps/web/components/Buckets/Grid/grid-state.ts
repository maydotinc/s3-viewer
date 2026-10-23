import type { ObjectCommands } from "@/components/Buckets/useObjectCommands";
import type { KnownReach } from "@/lib/utils/folder-access";
import { createContext, useContext } from "react";

type ObjectGridState = {
   serverId: string;
   bucketName: string;
   prefix: string;
   reach: KnownReach;
   commands: ObjectCommands;
};

// AG Grid reads `context` only when a cell is created, so cells read this instead.
const ObjectGridStateContext = createContext<ObjectGridState | null>(null);

const ObjectGridStateProvider = ObjectGridStateContext.Provider;

const useObjectGridState = (): ObjectGridState => {
   const state = useContext(ObjectGridStateContext);
   if (!state)
      throw new Error(
         "useObjectGridState must be used within an ObjectGridStateProvider"
      );
   return state;
};

export { ObjectGridStateProvider, useObjectGridState };
export type { ObjectGridState };
