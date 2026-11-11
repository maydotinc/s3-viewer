import { basicSetup } from "codemirror";
import { indentWithTab } from "@codemirror/commands";
import { indentUnit } from "@codemirror/language";
import {
   linter,
   lintGutter,
   openLintPanel,
   type Diagnostic,
} from "@codemirror/lint";
import { openSearchPanel } from "@codemirror/search";
import { Compartment, EditorState, Transaction } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { Button } from "@s3-viewer/ui/components/button";
import { FOCUS_RING } from "@s3-viewer/ui/lib/classes";
import { Search, WrapText } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import {
   canAnalyze,
   EDITOR_LANGUAGES,
   type EditorLanguage,
} from "./editor-language";
import { loadEditorSupport } from "./editor-support";

type CodeEditorProps = {
   value: string;
   onChange: (value: string) => void;
   language: EditorLanguage;
   onLanguageChange: (language: EditorLanguage) => void;
   readOnly: boolean;
   label: string;
   lineEnding: string;
};

type SyntaxStatus = "checking" | "ready" | "unsupported" | "limited" | "failed";

const editorTheme = EditorView.theme({
   "&": {
      height: "100%",
      color: "var(--color-viewerblack)",
      backgroundColor: "var(--color-viewerwhite)",
      fontSize: "12px",
   },
   "&.cm-focused": {
      outline: "2px solid var(--color-viewerblue)",
      outlineOffset: "-2px",
   },
   ".cm-scroller": {
      overflow: "auto",
      fontFamily: "var(--font-mono, ui-monospace, monospace)",
      lineHeight: "20px",
   },
   ".cm-content": { padding: "12px 0", caretColor: "var(--color-viewerblack)" },
   ".cm-line": { padding: "0 12px" },
   ".cm-gutters": {
      color: "var(--color-viewerlighttext)",
      backgroundColor: "var(--color-viewergray)",
      borderColor: "var(--color-viewerborder)",
   },
   ".cm-activeLine, .cm-activeLineGutter": {
      backgroundColor:
         "color-mix(in srgb, var(--color-viewerblue) 5%, transparent)",
   },
   ".cm-panels, .cm-tooltip": {
      color: "var(--color-viewerblack)",
      backgroundColor: "var(--color-viewergray)",
      borderColor: "var(--color-viewerborder)",
   },
   ".cm-panel.cm-search": { padding: "8px", fontFamily: "inherit" },
   ".cm-textfield": {
      backgroundColor: "var(--color-viewerwhite)",
      border: "1px solid var(--color-viewercontrolborder)",
      borderRadius: "4px",
   },
   ".cm-button": {
      color: "var(--color-viewerblack)",
      backgroundImage: "none",
      backgroundColor: "var(--color-viewerwhite)",
      border: "1px solid var(--color-viewercontrolborder)",
      borderRadius: "4px",
   },
   ".cm-diagnostic-error": { borderLeftColor: "var(--color-viewerstrongred)" },
   ".cm-panel.cm-panel-lint": { maxHeight: "120px" },
   "@media (max-width: 639px)": { "&": { fontSize: "16px" } },
});

const CodeEditor = (props: CodeEditorProps) => {
   const { value, language, readOnly } = props;
   const id = useId();
   const container = useRef<HTMLDivElement>(null);
   const viewRef = useRef<EditorView | null>(null);
   const latest = useRef(props);
   latest.current = props;
   const [compartments] = useState(() => ({
      language: new Compartment(),
      readOnly: new Compartment(),
      wrap: new Compartment(),
   }));
   const [wrapped, setWrapped] = useState(false);
   const [position, setPosition] = useState({ line: 1, column: 1 });
   const [syntax, setSyntax] = useState<SyntaxStatus>("checking");
   const [diagnostics, setDiagnostics] = useState<Diagnostic[]>([]);
   const validating = useRef(false);
   const analyze = canAnalyze(value);

   useEffect(() => {
      const view = new EditorView({
         parent: container.current!,
         doc: latest.current.value,
         extensions: [
            basicSetup,
            editorTheme,
            indentUnit.of("  "),
            keymap.of([indentWithTab]),
            compartments.language.of([]),
            compartments.readOnly.of(
               EditorState.readOnly.of(latest.current.readOnly)
            ),
            compartments.wrap.of([]),
            EditorView.contentAttributes.of({
               "aria-label": latest.current.label,
               "aria-describedby": `${id}-help`,
            }),
            EditorView.updateListener.of((update) => {
               if (update.docChanged) {
                  const text = update.state.doc.toString();
                  if (text !== latest.current.value)
                     latest.current.onChange(text);
                  if (validating.current) setSyntax("checking");
               }
               if (update.docChanged || update.selectionSet) {
                  const head = update.state.selection.main.head;
                  const line = update.state.doc.lineAt(head);
                  setPosition({
                     line: line.number,
                     column: head - line.from + 1,
                  });
               }
            }),
         ],
      });
      viewRef.current = view;
      return () => {
         viewRef.current = null;
         view.destroy();
      };
   }, [compartments, id]);

   useEffect(() => {
      const view = viewRef.current;
      if (!view || view.state.doc.toString() === value) return;
      view.dispatch({
         changes: { from: 0, to: view.state.doc.length, insert: value },
         annotations: Transaction.addToHistory.of(false),
      });
   }, [value]);

   useEffect(() => {
      viewRef.current?.dispatch({
         effects: compartments.readOnly.reconfigure(
            EditorState.readOnly.of(readOnly)
         ),
      });
   }, [readOnly, compartments]);

   useEffect(() => {
      viewRef.current?.dispatch({
         effects: compartments.wrap.reconfigure(
            wrapped ? EditorView.lineWrapping : []
         ),
      });
   }, [wrapped, compartments]);

   useEffect(() => {
      const view = viewRef.current;
      if (!view) return;
      let cancelled = false;
      validating.current = false;
      setDiagnostics([]);
      setSyntax(analyze ? "checking" : "limited");
      view.dispatch({ effects: compartments.language.reconfigure([]) });
      if (analyze) {
         void loadEditorSupport(language)
            .then((support) => {
               if (cancelled) return;
               const validate = support.validate;
               validating.current = !!validate;
               setSyntax(validate ? "checking" : "unsupported");
               view.dispatch({
                  effects: compartments.language.reconfigure([
                     support.extension,
                     ...(validate
                        ? [
                             lintGutter(),
                             linter(
                                (editor) => {
                                   if (cancelled) return [];
                                   try {
                                      const text = editor.state.doc.toString();
                                      if (!canAnalyze(text)) {
                                         setDiagnostics([]);
                                         setSyntax("limited");
                                         return [];
                                      }
                                      const issues = validate(text);
                                      setDiagnostics(issues);
                                      setSyntax("ready");
                                      return issues;
                                   } catch {
                                      setDiagnostics([]);
                                      setSyntax("failed");
                                      return [];
                                   }
                                },
                                { delay: 500 }
                             ),
                          ]
                        : []),
                  ]),
               });
            })
            .catch(() => {
               if (!cancelled) setSyntax("failed");
            });
      }
      return () => {
         cancelled = true;
      };
   }, [language, analyze, compartments]);

   const status =
      syntax === "checking"
         ? "Checking syntax…"
         : syntax === "limited"
           ? "Syntax analysis paused for large file"
           : syntax === "failed"
             ? "Syntax check unavailable"
             : syntax === "unsupported"
               ? "No syntax checker"
               : diagnostics.length
                 ? `${diagnostics.length}${diagnostics.length === 100 ? "+" : ""} syntax ${diagnostics.length === 1 ? "issue" : "issues"}`
                 : "No syntax issues";

   return (
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
         <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-viewerborder bg-viewergray px-3 py-1.5">
            <label htmlFor={`${id}-language`} className="sr-only">
               Language
            </label>
            <select
               id={`${id}-language`}
               value={language}
               onChange={(event) =>
                  props.onLanguageChange(event.target.value as EditorLanguage)
               }
               className={`h-8 max-w-40 rounded-md border border-viewerborder bg-viewerwhite px-2 text-xs text-viewerblack ${FOCUS_RING}`}
            >
               {Object.entries(EDITOR_LANGUAGES).map(([key, name]) => (
                  <option key={key} value={key}>
                     {name}
                  </option>
               ))}
            </select>
            <div className="ml-auto flex gap-1">
               <Button
                  variant="ghost"
                  size="icon-sm"
                  title="Find and replace (Ctrl/⌘ F)"
                  aria-label="Find and replace"
                  onClick={() => {
                     if (viewRef.current) openSearchPanel(viewRef.current);
                  }}
               >
                  <Search aria-hidden="true" />
               </Button>
               <Button
                  variant="ghost"
                  size="icon-sm"
                  title="Word wrap"
                  aria-label="Word wrap"
                  aria-pressed={wrapped}
                  onClick={() => setWrapped(!wrapped)}
               >
                  <WrapText aria-hidden="true" />
               </Button>
            </div>
         </div>
         <div
            ref={container}
            className="min-h-0 min-w-0 flex-1 overflow-hidden"
         />
         <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-t border-viewerborder px-3 py-1.5 text-xs text-viewerlighttext">
            <button
               type="button"
               disabled={syntax !== "ready" || !diagnostics.length}
               className={`min-w-0 rounded-sm text-left enabled:cursor-pointer enabled:text-viewerstrongred enabled:hover:underline ${FOCUS_RING}`}
               title="Syntax hints only; does not check types or runtime behavior. Click issues to see details."
               onClick={() => {
                  if (viewRef.current) openLintPanel(viewRef.current);
               }}
            >
               {status}
            </button>
            <span className="ml-auto whitespace-nowrap">
               Ln {position.line}, Col {position.column}
            </span>
            <span>{props.lineEnding}</span>
         </div>
         <p id={`${id}-help`} className="sr-only">
            Tab indents code. Press Escape, then Tab to move focus out of the
            editor. Use Control or Command F to find and replace. Syntax issues
            are hints and do not prevent saving.
         </p>
      </div>
   );
};

export default CodeEditor;
export type { CodeEditorProps };
