const FormError = ({
   id,
   children,
}: {
   id?: string;
   children?: string | null;
}) => (
   <p
      id={id}
      role="alert"
      className="min-h-5 text-xs leading-5 text-viewertextred"
   >
      {children}
   </p>
);

export default FormError;
