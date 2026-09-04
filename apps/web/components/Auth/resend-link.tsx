import { TEXT_LINK } from "@/components/Auth/text-link";
import type { AuthResult } from "@/lib/auth";
import { useEffect, useState } from "react";

const RESEND_SECONDS = 45;

type ResendLinkProps = {
   onResend: () => Promise<AuthResult>;
   onError: (message: string) => void;
   onSent?: () => void;
   disabled?: boolean;
   className?: string;
};

const ResendLink = ({
   onResend,
   onError,
   onSent,
   disabled,
   className,
}: ResendLinkProps) => {
   const [secondsLeft, setSecondsLeft] = useState(RESEND_SECONDS);
   const [resending, setResending] = useState(false);

   useEffect(() => {
      if (secondsLeft <= 0) return;
      const timer = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
      return () => clearTimeout(timer);
   }, [secondsLeft]);

   const canResend = secondsLeft <= 0 && !resending && !disabled;

   const resend = async () => {
      if (!canResend) return;
      setResending(true);
      const { error } = await onResend();
      setResending(false);
      if (error) {
         onError(error);
         return;
      }
      onSent?.();
      setSecondsLeft(RESEND_SECONDS);
   };

   return (
      <span className={className}>
         Didn&apos;t get it?{" "}
         <button
            type="button"
            onClick={resend}
            disabled={!canResend}
            className={TEXT_LINK}
         >
            {secondsLeft > 0 ? `Resend code in ${secondsLeft}s` : "Resend code"}
         </button>
      </span>
   );
};

export default ResendLink;
