import ErrorState from "@/components/Layout/error-state";
import { Page } from "@/components/Layout/page";
import CenteredSpinner from "@/components/centered-spinner";

type ServerPageStatusProps = {
   loading?: boolean;
   denied: string | null;
};

const ServerPageStatus = ({
   loading = false,
   denied,
}: ServerPageStatusProps) =>
   loading ? (
      <Page>
         <CenteredSpinner label="Loading server" />
      </Page>
   ) : (
      <Page>
         <ErrorState
            message={
               denied ??
               "This server doesn't exist, or you're not a member of it."
            }
         />
      </Page>
   );

export default ServerPageStatus;
