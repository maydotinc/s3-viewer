import Callout from "@/components/callout";

const NoEmailNotice = ({ children }: { children?: string }) => (
   <Callout>
      <p>
         This instance has no email configured, so invites can&apos;t be sent.
         {children && ` ${children}`}
      </p>
   </Callout>
);

export default NoEmailNotice;
