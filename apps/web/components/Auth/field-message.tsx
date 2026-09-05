// the line under an auth field: an error, or a hint while there is none. It
// reserves its height only when it has something to hold or is asked to, so a
// field with rare errors keeps the stack tight
const FieldMessage = ({
   id,
   error,
   hint,
   reserve = false,
}: {
   id: string;
   error: string | null;
   hint?: string;
   reserve?: boolean;
}) => {
   const content = error ?? hint;
   if (!content && !reserve) return null;
   return (
      <p
         id={id}
         role={error ? "alert" : undefined}
         className={
            error
               ? "min-h-5 text-sm leading-5 text-viewertextred"
               : "min-h-5 text-sm leading-5 text-viewerlighttext"
         }
      >
         {content}
      </p>
   );
};

export default FieldMessage;
