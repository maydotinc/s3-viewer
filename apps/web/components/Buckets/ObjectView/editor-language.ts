const EDITOR_LANGUAGES = {
   text: "Plain text",
   json: "JSON",
   javascript: "JavaScript",
   typescript: "TypeScript",
   jsx: "JSX",
   tsx: "TSX",
   yaml: "YAML",
   html: "HTML",
   css: "CSS",
   xml: "XML / SVG",
   markdown: "Markdown",
   shell: "Shell",
   toml: "TOML",
   properties: "INI / .env",
} as const;

type EditorLanguage = keyof typeof EDITOR_LANGUAGES;

const EXTENSIONS: Record<string, EditorLanguage> = {
   json: "json",
   js: "javascript",
   mjs: "javascript",
   cjs: "javascript",
   ts: "typescript",
   mts: "typescript",
   cts: "typescript",
   jsx: "jsx",
   tsx: "tsx",
   yaml: "yaml",
   yml: "yaml",
   html: "html",
   htm: "html",
   css: "css",
   xml: "xml",
   svg: "xml",
   md: "markdown",
   markdown: "markdown",
   sh: "shell",
   bash: "shell",
   zsh: "shell",
   toml: "toml",
   ini: "properties",
   env: "properties",
   properties: "properties",
   txt: "text",
   log: "text",
   csv: "text",
};

const detectEditorLanguage = (
   fileName: string,
   contentType: string
): EditorLanguage => {
   const name = fileName.split("/").pop()?.toLowerCase() ?? "";
   if (name === ".env" || name.startsWith(".env.")) return "properties";
   const extension = name.slice(name.lastIndexOf(".") + 1);
   if (Object.hasOwn(EXTENSIONS, extension)) return EXTENSIONS[extension]!;
   const mime = contentType.split(";")[0]?.trim().toLowerCase() ?? "";
   if (mime.endsWith("/json") || mime.endsWith("+json")) return "json";
   if (mime.endsWith("/yaml") || mime.endsWith("/x-yaml")) return "yaml";
   if (mime.endsWith("/typescript")) return "typescript";
   if (mime.endsWith("/javascript")) return "javascript";
   if (mime === "text/html") return "html";
   if (mime === "text/css") return "css";
   if (mime.endsWith("/xml") || mime.endsWith("+xml")) return "xml";
   if (mime === "text/markdown") return "markdown";
   if (mime === "application/x-sh") return "shell";
   return "text";
};

// Parsing is synchronous. Bound its cost independently of the object editing limit.
const canAnalyze = (text: string): boolean => {
   if (text.length > 200_000) return false;
   let lines = 1;
   for (
      let index = text.indexOf("\n");
      index !== -1;
      index = text.indexOf("\n", index + 1)
   ) {
      if (++lines > 10_000) return false;
   }
   return true;
};

export { EDITOR_LANGUAGES, detectEditorLanguage, canAnalyze };
export type { EditorLanguage };
