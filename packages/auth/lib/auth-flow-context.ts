import { AsyncLocalStorage } from "node:async_hooks";

type AuthFlowStore = {
   email: string;
   otp?: string;
   magicLinkUrl?: string;
};

const authFlowContext = new AsyncLocalStorage<AuthFlowStore>();

export { authFlowContext };
export type { AuthFlowStore };
