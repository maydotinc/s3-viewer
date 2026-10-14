import { visibleText } from "@/lib/utils/format";
import { folderList } from "@/lib/utils/folder-access";
import { isLossyKeySegment } from "@/lib/utils/s3/key-segments";
import {
   MAX_GRANT_FOLDERS,
   grantFolderSchema,
   hasDotSegment,
   isInFolderScope,
   isSafeKeyText,
   normalizeFolders,
   utf8ByteLength,
   type FolderScope,
} from "@s3-viewer/types";

const MAX_FOLDER_BYTES = 1024;

// Hangul fillers and the Braille blank render as nothing, so a folder made only of them looks empty.
const INVISIBLE =
   /^[\p{Cf}\p{Cc}\p{Z}\p{Mn}\p{Me}\s\u{115F}\u{1160}\u{2800}\u{3164}\u{FFA0}]*$/u;

const normalizeFolderInput = (raw: string): string => {
   const trimmed = raw.trim().replace(/^\/+/, "");
   return trimmed === "" || trimmed.endsWith("/") ? trimmed : `${trimmed}/`;
};

const folderInputError = (folder: string): string | null => {
   if (!folder) return "Enter a folder name.";
   const parts = folder.slice(0, -1).split("/");
   if (parts.some(isLossyKeySegment) || hasDotSegment(folder))
      return 'A folder can\'t have empty, "." or ".." parts.';
   if (!isSafeKeyText(folder))
      return "A folder can't contain control characters.";
   if (parts.some((part) => INVISIBLE.test(part)))
      return "A folder can't have parts with no visible characters.";
   if (utf8ByteLength(folder) > MAX_FOLDER_BYTES)
      return "A folder can be at most 1,024 bytes long.";
   return grantFolderSchema.safeParse(folder).success
      ? null
      : "Enter a valid folder name.";
};

type FolderAddition =
   | {
        ok: true;
        folder: string;
        folders: string[];
        replaced: string[];
        notice: string | null;
     }
   | { ok: false; error: string };

const addGrantFolder = (
   current: readonly string[],
   raw: string,
   held: FolderScope
): FolderAddition => {
   const folder = normalizeFolderInput(raw);
   const invalid = folderInputError(folder);
   if (invalid) return { ok: false, error: invalid };
   if (current.includes(folder))
      return {
         ok: false,
         error: `${visibleText(folder)} is already in the list.`,
      };
   if (held !== null && !isInFolderScope(held, folder))
      return {
         ok: false,
         error: `You can only share folders inside ${folderList(held)}.`,
      };
   const broader = current.find((existing) => folder.startsWith(existing));
   const folders = normalizeFolders([
      ...current.filter((existing) => existing !== broader),
      folder,
   ]);
   // merging can shorten a full list, so the limit applies afterwards.
   if (folders.length > MAX_GRANT_FOLDERS)
      return {
         ok: false,
         error: `You can add up to ${MAX_GRANT_FOLDERS} folders.`,
      };
   const replaced = current.filter((existing) => !folders.includes(existing));
   const shown = visibleText(folder);
   const notice = broader
      ? `Replaced ${visibleText(broader)} with ${shown}, so only ${shown} is shared.`
      : replaced.length > 0
        ? `Removed ${folderList(replaced)}, since ${shown} includes ${replaced.length === 1 ? "it" : "them"}.`
        : null;
   return { ok: true, folder, folders, replaced, notice };
};

type Tone = "error" | "notice";
type Message = { tone: Tone; text: string };

type Feedback = Message & { folders: string };

const feedbackFor = (
   tone: Tone,
   text: string,
   folders: readonly string[]
): Feedback => ({ tone, text, folders: JSON.stringify(folders) });

const hintFor = ({
   folders,
   draft,
   held,
   hasSuggestion,
}: {
   folders: readonly string[];
   draft: string;
   held: FolderScope;
   hasSuggestion: boolean;
}): string => {
   if (draft.trim())
      return hasSuggestion
         ? "→ to autocomplete. Press Enter or Add to add it."
         : "Press Enter or Add to add it.";
   const where = held === null ? "" : `Inside ${folderList(held)} only. `;
   if (folders.length >= MAX_GRANT_FOLDERS)
      return `${where}That's the limit of ${MAX_GRANT_FOLDERS} folders. A parent folder can still replace the ones inside it.`;
   return `${where}A folder doesn't have to exist yet.`;
};

const editorMessages = ({
   feedback,
   folders,
   draft,
   error,
   showError,
   hint,
}: {
   feedback: Feedback | null;
   folders: readonly string[];
   draft: string;
   error: string | null;
   showError: boolean;
   hint: string;
}): Message[] => {
   const messages: Message[] = [];
   if (feedback && feedback.folders === JSON.stringify(folders))
      messages.push({ tone: feedback.tone, text: feedback.text });
   if (error && showError) messages.push({ tone: "error", text: error });
   else if (messages.length === 0)
      messages.push({
         tone: "notice",
         text: draft.trim() ? hint : (error ?? hint),
      });
   return messages.filter(
      (message, index) =>
         messages.findIndex((other) => other.text === message.text) === index
   );
};

export {
   addGrantFolder,
   editorMessages,
   feedbackFor,
   folderInputError,
   hintFor,
   normalizeFolderInput,
};
export type { Feedback };
