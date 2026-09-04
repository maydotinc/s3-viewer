const INVITE_EMAILS_ID = "invite-emails";

const focusInviteEmails = () => {
   const field = document.getElementById(INVITE_EMAILS_ID);
   if (!field) return;
   field.scrollIntoView({ behavior: "smooth", block: "center" });
   field.focus({ preventScroll: true });
};

export { INVITE_EMAILS_ID, focusInviteEmails };
