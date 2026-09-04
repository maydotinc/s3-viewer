// the reserved line under an auth field: an error, or a hint while there is none
const FieldMessage = ({
   id,
   error,
   hint,
}: {
   id: string;
   error: string | null;
   hint?: string;
}) => (
   <p
      id={id}
      role={error ? "alert" : undefined}
      className={
         error
            ? "min-h-5 text-sm leading-5 text-viewertextred"
            : "min-h-5 text-sm leading-5 text-viewerlighttext"
      }
   >
      {error ?? hint}
   </p>
);

export default FieldMessage;
