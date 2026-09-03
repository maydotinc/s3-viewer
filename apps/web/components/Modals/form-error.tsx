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
      className="min-h-5 text-sm leading-5 text-viewertextred"
   >
      {children}
   </p>
);

export default FormError;
