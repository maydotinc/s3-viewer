import { IMAGE_PLACEHOLDERS } from "../components/Landing/image-placeholders";

type BlurProps = { placeholder: "blur" | "empty"; blurDataURL?: string };

export const blurProps = (src: string): BlurProps => {
   const blurDataURL = IMAGE_PLACEHOLDERS[src];
   return blurDataURL
      ? { placeholder: "blur", blurDataURL }
      : { placeholder: "empty" };
};
