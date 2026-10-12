const MAX_GUTTER_LINES = 2_000;

type LineEnding = "\n" | "\r\n";

type SaveShortcut = {
   key: string;
   metaKey: boolean;
   ctrlKey: boolean;
};

const dominantLineEnding = (text: string): LineEnding => {
   const crlf = text.split("\r\n").length - 1;
   const lf = text.split("\n").length - 1 - crlf;
   return crlf > lf ? "\r\n" : "\n";
};

const toEditorText = (text: string): string => text.replace(/\r\n/g, "\n");

const applyLineEnding = (text: string, ending: LineEnding): string =>
   ending === "\r\n" ? toEditorText(text).replace(/\n/g, "\r\n") : text;

const editorLineCount = (text: string): number | null => {
   let count = 1;
   for (
      let position = text.indexOf("\n");
      position !== -1;
      position = text.indexOf("\n", position + 1)
   ) {
      if (++count > MAX_GUTTER_LINES) return null;
   }
   return count;
};

const isSaveShortcut = (event: SaveShortcut): boolean =>
   (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s";

export {
   editorLineCount,
   applyLineEnding,
   dominantLineEnding,
   isSaveShortcut,
   toEditorText,
};
export type { LineEnding };
