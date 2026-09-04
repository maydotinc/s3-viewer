const NAME_MAX = 80;

// better auth's user model still declares `image`, so /update-user can always
// carry one; it is stripped rather than rejected so nothing 400s over a field
// the ui no longer offers
type ProfileInput = { name?: string; image?: unknown };

// `image: undefined` must stay an own property: it overrides the incoming value
// when spread, and prisma reads undefined as "leave this column alone"
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
