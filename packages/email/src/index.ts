import S3ViewerEmailOTP from "@s3-viewer/ui/emails/auth-otp";
import S3ViewerServerInviteEmail from "@s3-viewer/ui/emails/server-invite";

type SendOtpEmailInput = {
   to: string;
   otp: string;
};

type SendServerInviteEmailInput = {
   to: string;
   serverName: string;
   role: string;
   invitedByEmail: string;
   invitedByName?: string;
   expiresAt: Date;
   invitesUrl: string;
};

let resendInstance: import("resend").Resend | null = null;

const getResend = async () => {
   if (!resendInstance) {
      const { Resend } = await import("resend");
      resendInstance = new Resend(process.env.RESEND_KEY);
   }

   return resendInstance;
};

const isProductionEmailEnabled = () => {
   return process.env.NODE_ENV === "production";
};

const sendOtpEmail = async ({ to, otp }: SendOtpEmailInput) => {
   // if (!isProductionEmailEnabled()) {
   //    console.log(`[email] OTP to ${to}: ${otp}`);
   //    return;
   // }

   try {
      const resend = await getResend();
      const { error } = await resend.emails.send({
         from: "S3 Viewer <auth@s3-viewer.com>",
         to: [to],
         subject: "S3 Viewer Login Code",
         react: S3ViewerEmailOTP({ loginCode: otp }),
      });

      if (error) {
         throw new Error(`${error.name}: ${error.message}`);
      }
   } catch (error) {
      console.error("[email] Error sending OTP:", error);
   }
};

const sendServerInviteEmail = async ({
   to,
   serverName,
   role,
   invitedByEmail,
   invitedByName,
   expiresAt,
   invitesUrl,
}: SendServerInviteEmailInput) => {
   // if (!isProductionEmailEnabled()) {
   //    console.log(
   //       `[email] Invite to ${to}: server=${serverName} role=${role} invitedBy=${invitedByEmail} expiresAt=${expiresAt.toISOString()} url=${invitesUrl}`
   //    );
   //    return;
   // }

   try {
      const resend = await getResend();
      const { error } = await resend.emails.send({
         from: "S3 Viewer <auth@s3-viewer.com>",
         to: [to],
         subject: `You're invited to ${serverName} on S3 Viewer`,
         react: S3ViewerServerInviteEmail({
            serverName,
            role,
            invitedByEmail,
            invitedByName,
            expiresAtIso: expiresAt.toISOString(),
            invitesUrl,
         }),
      });

      if (error) {
         throw new Error(`${error.name}: ${error.message}`);
      }
   } catch (error) {
      console.error("[email] Error sending server invite:", error);
   }
};

export { sendOtpEmail, sendServerInviteEmail };
