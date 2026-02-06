import useAuthStore from "@/lib/stores/authStore";
import { authClient, verifyOtp } from "@s3-viewer/auth/client";
import { cn } from "@s3-viewer/ui/lib/utils";
import { useRouter } from "next/router";
import React, { useEffect, useRef, useState } from "react";

interface OTPInputProps {
   length?: number;
}

const OTPInput: React.FC<OTPInputProps> = ({ length = 6 }) => {
   const router = useRouter();
   const { email, name, setVerifying, authType, setError } = useAuthStore();
   const [otp, setOtp] = useState<string[]>(Array(length).fill(""));
   const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

   useEffect(() => {
      if (inputRefs.current[0]) {
         inputRefs.current[0].focus();
      }
   }, []);

   const verify = async (code: string) => {
      setVerifying(true);

      if (code.length !== length) {
         setVerifying(false);
         return;
      }

      try {
         const { error } = await verifyOtp(email, code);
         if (error) {
            setError(error);
            return;
         }

         setError(null);
         if (authType === "signup") {
            const { error: updateError } = await authClient.updateUser({
               name,
            });
            if (updateError) {
               setError(updateError.message ?? updateError.statusText);
               return;
            }
         }

         await router.push("/dashboard");
      } finally {
         setVerifying(false);
      }
   };

   const handleChange = (element: HTMLInputElement, index: number) => {
      setError(null);
      const value = element.value.replace(/\D/g, "").slice(0, 1);

      const newOtp = [...otp];
      newOtp[index] = value;
      setOtp(newOtp);

      if (value !== "" && index < length - 1) {
         inputRefs.current[index + 1]?.focus();
      }

      if (newOtp.every((digit) => digit !== "")) {
         verify(newOtp.join(""));
      }
   };

   const handleKeyDown = (
      e: React.KeyboardEvent<HTMLInputElement>,
      index: number
   ) => {
      if (e.key === "Backspace" && !otp[index] && index > 0) {
         inputRefs.current[index - 1]?.focus();
      } else if (e.key === "Enter") {
         verify(otp.join(""));
      }
   };

   const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
      e.preventDefault();
      const pastedData = e.clipboardData
         .getData("text/plain")
         .replace(/\D/g, "")
         .slice(0, length);

      const newOtp = [
         ...pastedData.split(""),
         ...Array(length - pastedData.length).fill(""),
      ];
      setOtp(newOtp);

      if (newOtp.every((digit) => digit !== "")) {
         verify(newOtp.join(""));
      }

      const nextEmptyIndex = newOtp.findIndex((digit) => digit === "");
      const focusIndex = nextEmptyIndex === -1 ? length - 1 : nextEmptyIndex;
      inputRefs.current[focusIndex]?.focus();
   };

   const handleDoubleClick = () => {
      setOtp(Array(length).fill(""));
   };

   return (
      <div className="space-y-2">
         <div className="flex items-center justify-center space-x-2">
            {otp.map((digit, index) => (
               <input
                  key={index}
                  ref={(ref) => {
                     inputRefs.current[index] = ref;
                  }}
                  type="text"
                  inputMode="numeric"
                  pattern="\d*"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleChange(e.target, index)}
                  onKeyDown={(e) => handleKeyDown(e, index)}
                  onPaste={handlePaste}
                  onDoubleClick={handleDoubleClick}
                  className={cn(
                     "h-12 w-[calc(20%-8px)] sm:h-14 sm:w-[calc(20%-8px)] bg-[#FCFCFC] rounded-md border border-[#EEEEEE] text-center text-lg sm:text-xl focus:outline-none text-black font-semibold"
                  )}
               />
            ))}
         </div>
      </div>
   );
};

export default OTPInput;
