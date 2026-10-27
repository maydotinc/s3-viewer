import { emailSchema, profileNameSchema } from "@s3-viewer/shared";
import { INVALID_EMAIL_MESSAGE, INVALID_NAME_MESSAGE } from "./errors";

type ProfileInput = { name?: unknown; email?: unknown };

type Profile = { name: string; email: string };

// keep an own property: undefined overrides the input without writing a Prisma column.
type ProfileChange = Partial<Profile> & { image?: undefined };

type Checked<T> = { ok: true; data: T } | { ok: false; message: string };

type Parser<T> = {
   safeParse: (
      value: unknown
   ) => { success: true; data: T } | { success: false };
};

const field =
   <T>(parser: Parser<T>, message: string) =>
   (value: unknown): Checked<T> => {
      const parsed = parser.safeParse(value);
      return parsed.success
         ? { ok: true, data: parsed.data }
         : { ok: false, message };
   };

const checkEmail = field(emailSchema, INVALID_EMAIL_MESSAGE);
const checkName = field(profileNameSchema, INVALID_NAME_MESSAGE);

const validateNewProfile = (input: ProfileInput): Checked<Profile> => {
   const email = checkEmail(input.email);
   if (!email.ok) return email;
   const name = checkName(input.name);
   if (!name.ok) return name;
   return { ok: true, data: { email: email.data, name: name.data } };
};

const validateProfileChange = (input: ProfileInput): Checked<ProfileChange> => {
   const data: ProfileChange = { image: undefined };
   if (input.email !== undefined) {
      const email = checkEmail(input.email);
      if (!email.ok) return email;
      data.email = email.data;
   }
   if (input.name !== undefined) {
      const name = checkName(input.name);
      if (!name.ok) return name;
      data.name = name.data;
   }
   return { ok: true, data };
};

export { validateNewProfile, validateProfileChange };
