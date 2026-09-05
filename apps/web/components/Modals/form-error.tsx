const FormError = ({
   id,
   hint,
   children,
}: {
   id?: string;
   hint?: string;
   children?: string | null;
}) => (
   <p
      id={id}
      role={children ? "alert" : undefined}
      className={
         children
            ? "min-h-5 text-xs leading-5 text-viewertextred"
            : "min-h-5 text-xs leading-5 text-viewertext"
      }
   >
      {children ?? hint}
   </p>
);

export default FormError;
