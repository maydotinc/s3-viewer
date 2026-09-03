import { SITE_PATHS } from "@s3-viewer/types";
import type { GetServerSideProps } from "next";

// Invites moved into settings; invite emails and old links still point here.
export const getServerSideProps: GetServerSideProps = async () => ({
   redirect: { destination: SITE_PATHS.settingsInvites, permanent: false },
});

const InvitesPage = () => null;

export default InvitesPage;
