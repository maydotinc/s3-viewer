import ErrorState from "@/components/Layout/error-state";
import { Page } from "@/components/Layout/page";

type ServerPageStatusProps = {
   denied: string | null;
};

const ServerPageStatus = ({ denied }: ServerPageStatusProps) => (
   <Page>
      <ErrorState
         message={
            denied ?? "This server doesn't exist, or you're not a member of it."
         }
      />
   </Page>
);

export default ServerPageStatus;
