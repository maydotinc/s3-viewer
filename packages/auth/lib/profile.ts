const NAME_MAX = 80;

/**
 * `image` is not part of the product. Better Auth's core user model still
 * declares the column, so an `/update-user` call can always carry one — it is
 * accepted and stripped rather than rejected, so nothing 400s over a field
 * the UI no longer offers.
 */
type ProfileInput = { name?: string; image?: unknown };

/** `image: undefined` is a deliberate own property: it overrides the incoming
 * value when spread, and Prisma treats undefined as "leave this column". */
type ProfileData = { name?: string; image?: undefined };

type ProfileResult =
   | { ok: true; data: ProfileData }
   | { ok: false; message: string };

const validateProfile = ({ name }: ProfileInput): ProfileResult => {
   const data: ProfileData = { image: undefined };
   if (name !== undefined) {
      const trimmed = name.trim();
      if (trimmed.length === 0 || trimmed.length > NAME_MAX) {
         return {
            ok: false,
            message: `Enter a name of up to ${NAME_MAX} characters.`,
         };
      }
      data.name = trimmed;
   }
   return { ok: true, data };
};

export { NAME_MAX, validateProfile };
