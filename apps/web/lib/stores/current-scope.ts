import useSessionStore from "@/lib/stores/session-store";

type Scope = { userId: string; serverId: string };

// work captured under one scope still applies only while the live session and the latest render both agree;
// the store moves on before React re-renders, so neither check alone is enough
const isCurrentScope = <T extends Scope>(captured: T, rendered: T): boolean => {
   const session = useSessionStore.getState();
   return (
      session.userId === captured.userId &&
      session.serverId === captured.serverId &&
      (Object.keys(rendered) as (keyof T)[]).every(
         (key) => captured[key] === rendered[key]
      )
   );
};

export { isCurrentScope };
