import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

// Tailwind looks for `tailwind.config.js` relative to the PROCESS CWD. In the
// single-package layout the cwd is the repo root, but the config lives in
// `client/`, so an unqualified search silently falls back to Tailwind's
// defaults: no `content`, therefore no custom colours, font sizes or
// min-h-touch utilities, and the build dies on the first unknown class
// (`bg-paper` in index.css). Naming the file removes the cwd dependency.
const tailwindConfig = path.join(here, 'tailwind.config.js').split(path.sep).join('/');

export default {
  plugins: {
    tailwindcss: { config: tailwindConfig },
    autoprefixer: {},
  },
};
