// better-auth routes both sides address by path; kept apart from auth.ts so the
// browser client can import them without pulling in the server.
const PASSWORD_SIGN_UP_PATH = "/sign-up/email";
const SIGN_IN_PATH = "/sign-in/email";
const SEND_CODE_PATH = "/email-otp/send-verification-otp";
const VERIFY_CODE_PATH = "/email-otp/verify-email";
const DELETE_USER_PATH = "/delete-user";

export {
   DELETE_USER_PATH,
   PASSWORD_SIGN_UP_PATH,
   SEND_CODE_PATH,
   SIGN_IN_PATH,
   VERIFY_CODE_PATH,
};
