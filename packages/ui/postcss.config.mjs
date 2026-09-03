import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const config = {
   plugins: {
      "@tailwindcss/postcss": {
         base: join(__dirname, "../../"),
      },
   },
};

export default config;
