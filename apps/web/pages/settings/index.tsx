import { SITE_PATHS } from "@s3-viewer/types";
import type { GetServerSideProps } from "next";

export const getServerSideProps: GetServerSideProps = async () => ({
   redirect: { destination: SITE_PATHS.settingsProfile, permanent: false },
});

const SettingsPage = () => null;

export default SettingsPage;
