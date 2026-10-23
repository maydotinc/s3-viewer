import BrandKit from "@/components/BrandKit";
import Seo from "@/components/seo";
import { pageJsonLd } from "@/lib/jsonld";

const JSON_LD = pageJsonLd({
   name: "S3 Viewer Brand Kit",
   path: "/brand-kit",
   description:
      "Official brand assets for S3 Viewer: logos, colors, typography, and voice guidelines.",
   crumbs: "Brand kit",
});

const BrandKitPage = () => {
   return (
      <>
         <Seo
            title="Brand Kit"
            description="Official S3 Viewer brand assets — logos, colors, typography, and voice guidelines for press, partners, and contributors."
            canonical="/brand-kit"
            jsonLd={JSON_LD}
         />
         <BrandKit />
      </>
   );
};

export default BrandKitPage;
