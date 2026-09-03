import { SITE_PATHS } from "@s3-viewer/types";
import type { GetServerSideProps } from "next";

export const getServerSideProps: GetServerSideProps = async () => ({
   redirect: { destination: SITE_PATHS.settingsProfile, permanent: false },
});

/** `/settings` only redirects to the first sub-page. */
const SettingsPage = () => null;

export default SettingsPage;
