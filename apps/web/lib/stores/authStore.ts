import { isValidEmail } from "@s3-viewer/ui/lib/utils";
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";

export type AuthType = "signin" | "signup";

type InvalidField = "name" | "email";

type AuthState = {
   authType: AuthType;
   name: string;
   email: string;
   isValidEmail: boolean;
   loading: boolean;
   verifying: boolean;
   otpSent: boolean;
   invalidFields: InvalidField[];
   error: string | null;
   setInvalidFields: (invalidFields: InvalidField[]) => void;
};

type AuthActions = {
   toggleAuthType: () => void;
   setError: (error: string | null) => void;
   setName: (name: string) => void;
   setEmail: (email: string) => void;
   setIsValidEmail: (isValidEmail: boolean) => void;
   setLoading: (loading: boolean) => void;
   validateEmail: () => boolean;
   setVerifying: (verifying: boolean) => void;
   setOtpSent: (otpSent: boolean) => void;
   reset: () => void;
};

type AuthStore = AuthState & AuthActions;

const useAuthStore = create<AuthStore>()(
   immer((set) => ({
      authType: "signin",
      name: "",
      email: "",
      isValidEmail: false,
      loading: false,
      verifying: false,
      otpSent: false,
      invalidFields: [],
      error: null,
      setInvalidFields: (invalidFields) => set({ invalidFields }),
      toggleAuthType: () =>
         set((state) => ({
            authType: state.authType === "signin" ? "signup" : "signin",
         })),
      setName: (name) => set({ name }),
      setEmail: (email) => set({ email }),
      setIsValidEmail: (isValidEmail) => set({ isValidEmail }),
      setLoading: (loading) => set({ loading }),
      validateEmail: () => {
         let isValid = true;
         set((state) => {
            if (!state.name && state.authType === "signup") {
               isValid = false;
            }
            if (!state.email) {
               isValid = false;
            }
            if (!isValidEmail(state.email)) {
               isValid = false;
            }
         });
         return isValid;
      },
      setOtpSent: (otpSent) => set({ otpSent }),
      setVerifying: (verifying) => set({ verifying }),
      setError: (error) => set({ error }),
      reset: () =>
         set((state) => ({
            authType: state.authType,
            name: state.name,
            email: "",
            isValidEmail: false,
            loading: false,
            verifying: false,
            otpSent: false,
            invalidFields: [],
            error: null,
         })),
   }))
);

export default useAuthStore;
