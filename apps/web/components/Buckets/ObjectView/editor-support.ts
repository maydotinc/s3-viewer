import type { Language, LanguageSupport } from "@codemirror/language";
import type { Diagnostic } from "@codemirror/lint";
import type { Extension } from "@codemirror/state";
import type { EditorLanguage } from "./editor-language";

type LanguageSupportConfig = {
   extension: Extension;
   validate?: (text: string) => Diagnostic[];
};

const MAX_DIAGNOSTICS = 100;

// These are parser hints, not semantic linting or TypeScript type checks.
const syntaxDiagnostics = (language: Language, text: string): Diagnostic[] => {
   const diagnostics: Diagnostic[] = [];
   language.parser.parse(text).iterate({
      enter(node) {
         if (diagnostics.length >= MAX_DIAGNOSTICS) return false;
         const tagIssue = {
            MissingCloseTag: "Missing closing tag.",
            MismatchedCloseTag: "Closing tag does not match the opening tag.",
            UnexpectedCloseTag: "Unexpected closing tag.",
         }[node.name];
         if (!node.type.isError && !tagIssue) return true;
         diagnostics.push({
            from: node.from,
            to: Math.min(text.length, Math.max(node.to, node.from + 1)),
            severity: "error",
            message:
               tagIssue ??
               (node.from === text.length
                  ? "Unexpected end of file. Check for missing brackets, quotes, or tags."
                  : "Unexpected syntax. Check for missing or misplaced characters."),
         });
         return false;
      },
   });
   return diagnostics;
};

const withSyntax = (support: LanguageSupport): LanguageSupportConfig => ({
   extension: support,
   validate: (text) => syntaxDiagnostics(support.language, text),
});

const loadEditorSupport = async (
   language: EditorLanguage
): Promise<LanguageSupportConfig> => {
   switch (language) {
      case "json": {
         const { json } = await import("@codemirror/lang-json");
         const support = json();
         return {
            extension: support,
            validate: (text) => {
               try {
                  JSON.parse(text);
                  return [];
               } catch {
                  const issues = syntaxDiagnostics(support.language, text);
                  return issues.length
                     ? issues
                     : [
                          {
                             from: 0,
                             to: Math.min(1, text.length),
                             severity: "error",
                             message:
                                "Invalid JSON. Check quotes, commas, and values.",
                          },
                       ];
               }
            },
         };
      }
      case "javascript":
      case "typescript":
      case "jsx":
      case "tsx": {
         const { javascript } = await import("@codemirror/lang-javascript");
         return withSyntax(
            javascript({
               typescript: language === "typescript" || language === "tsx",
               jsx: language === "jsx" || language === "tsx",
            })
         );
      }
      case "yaml": {
         const [{ yaml }, { parseAllDocuments }] = await Promise.all([
            import("@codemirror/lang-yaml"),
            import("yaml"),
         ]);
         return {
            extension: yaml(),
            validate: (text) =>
               parseAllDocuments(text, { prettyErrors: false })
                  .flatMap((document) => [
                     ...document.errors.map((error) => ({
                        error,
                        severity: "error" as const,
                     })),
                     ...document.warnings.map((error) => ({
                        error,
                        severity: "warning" as const,
                     })),
                  ])
                  .slice(0, MAX_DIAGNOSTICS)
                  .map(({ error, severity }) => ({
                     from: Math.min(text.length, error.pos[0]),
                     to: Math.min(
                        text.length,
                        Math.max(error.pos[1], error.pos[0] + 1)
                     ),
                     severity,
                     message: error.message,
                  })),
         };
      }
      case "html": {
         const { html } = await import("@codemirror/lang-html");
         return withSyntax(html());
      }
      case "css": {
         const { css } = await import("@codemirror/lang-css");
         return withSyntax(css());
      }
      case "xml": {
         const { xml } = await import("@codemirror/lang-xml");
         return withSyntax(xml());
      }
      case "markdown": {
         const { markdown } = await import("@codemirror/lang-markdown");
         return { extension: markdown() };
      }
      case "shell": {
         const [{ StreamLanguage }, { shell }] = await Promise.all([
            import("@codemirror/language"),
            import("@codemirror/legacy-modes/mode/shell"),
         ]);
         return { extension: StreamLanguage.define(shell) };
      }
      case "toml": {
         const [{ StreamLanguage }, { toml }] = await Promise.all([
            import("@codemirror/language"),
            import("@codemirror/legacy-modes/mode/toml"),
         ]);
         return { extension: StreamLanguage.define(toml) };
      }
      case "properties": {
         const [{ StreamLanguage }, { properties }] = await Promise.all([
            import("@codemirror/language"),
            import("@codemirror/legacy-modes/mode/properties"),
         ]);
         return { extension: StreamLanguage.define(properties) };
      }
      default:
         return { extension: [] };
   }
};

export { loadEditorSupport };
