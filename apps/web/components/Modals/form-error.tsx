// the reserved line under a field: the error when there is one, otherwise an
// optional hint, so the form never grows when an error appears
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
