import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** @type {import('postcss-load-config').Config} */
const config = {
    plugins: { 
        "@tailwindcss/postcss": {
            /* 
            * Ensures that the tailwind config is relative to the root of the project
            * so that all styling is processed correctly
            */
            base: join(__dirname, '../../')
        } 
    },
};

export default config;
