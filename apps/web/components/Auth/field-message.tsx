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
