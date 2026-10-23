import { pluralize } from "@/lib/utils/format";
import { Button } from "@s3-viewer/ui/components/button";
import { cn } from "@s3-viewer/ui/lib/utils";
import { Image as ImageIcon } from "lucide-react";
import { marked, type Token, type Tokens } from "marked";
import {
   createContext,
   createElement,
   Fragment,
   useContext,
   useMemo,
   useState,
   type ReactNode,
} from "react";

// the document renders in the app origin, where a javascript: or data: href would run with the viewer's session
const SAFE_LINK = /^(https?:|mailto:)/i;
const SAFE_IMAGE = /^https?:/i;

// marked leaves character references for its html renderer; a textarea decodes them without parsing markup
const decodeEntities = (text: string): string => {
   if (!text.includes("&") || typeof document === "undefined") return text;
   const area = document.createElement("textarea");
   area.innerHTML = text;
   return area.value;
};

const safeUrl = (href: string, allowed: RegExp): string | null => {
   const url = decodeEntities(href).trim();
   return allowed.test(url) ? url : null;
};

const hostOf = (url: string): string | null => {
   try {
      return new URL(url).host || null;
   } catch {
      return null;
   }
};

const remoteImage = ({
   href,
}: Tokens.Image): { url: string; host: string } | null => {
   const url = safeUrl(href, SAFE_IMAGE);
   const host = url && hostOf(url);
   return url && host ? { url, host } : null;
};

const imageHosts = (tokens: Token[]): string[] => {
   const hosts: string[] = [];
   marked.walkTokens(tokens, (token) => {
      if (token.type !== "image") return;
      const image = remoteImage(token as Tokens.Image);
      if (image) hosts.push(image.host);
   });
   return hosts;
};

type RemoteImages = {
   allowed: ReadonlySet<string>;
   allow: (host: string) => void;
};

const RemoteImagesContext = createContext<RemoteImages>({
   allowed: new Set(),
   allow: () => undefined,
});

// a button can't sit inside a link, so linked images (badges) load from the bar above the document
const InsideLink = createContext(false);

const PLACEHOLDER =
   "inline-flex max-w-full items-center gap-1.5 rounded-md border border-dashed border-viewerborder px-2 py-1 align-middle text-xs text-viewertext";

// fetching a remote image hands the viewer's IP and the moment they opened the file to whoever wrote the markdown
const RemoteImage = ({
   url,
   host,
   alt,
   title,
}: {
   url: string;
   host: string;
   alt: string;
   title: string | undefined;
}) => {
   const { allowed, allow } = useContext(RemoteImagesContext);
   const insideLink = useContext(InsideLink);
   if (allowed.has(host))
      // sizes aren't known ahead of time, so next/image has nothing to lay out with
      return (
         // eslint-disable-next-line @next/next/no-img-element
         <img
            src={url}
            alt={alt}
            title={title}
            loading="lazy"
            referrerPolicy="no-referrer"
         />
      );
   const label = (
      <>
         <ImageIcon className="size-3.5 shrink-0" aria-hidden="true" />
         <span className="min-w-0 truncate">{alt || "Image"}</span>
         <span className="shrink-0 text-viewerlighttext">{host}</span>
      </>
   );
   if (insideLink) return <span className={PLACEHOLDER}>{label}</span>;
   return (
      <button
         type="button"
         title={`Load images from ${host}`}
         className={cn(
            PLACEHOLDER,
            "cursor-pointer outline-none transition-colors hover:border-viewerblue hover:text-viewerblack focus-visible:border-viewerblue"
         )}
         onClick={() => allow(host)}
      >
         {label}
      </button>
   );
};

const renderTokens = (tokens: Token[] | undefined): ReactNode[] =>
   (tokens ?? []).map((token, index) => (
      <Fragment key={index}>{renderToken(token)}</Fragment>
   ));

const Cell = ({
   cell,
   row,
}: {
   cell: Tokens.TableCell;
   row: "header" | "body";
}) =>
   createElement(
      row === "header" ? "th" : "td",
      { align: cell.align ?? undefined },
      ...renderTokens(cell.tokens)
   );

const renderToken = (token: Token): ReactNode => {
   switch (token.type) {
      case "heading": {
         const { depth, tokens } = token as Tokens.Heading;
         return createElement(
            `h${Math.min(depth, 6)}`,
            null,
            ...renderTokens(tokens)
         );
      }
      case "paragraph":
         return <p>{renderTokens((token as Tokens.Paragraph).tokens)}</p>;
      case "text": {
         const { text, tokens } = token as Tokens.Text;
         return tokens ? renderTokens(tokens) : decodeEntities(text);
      }
      case "escape":
         return (token as Tokens.Escape).text;
      case "strong":
         return (
            <strong>{renderTokens((token as Tokens.Strong).tokens)}</strong>
         );
      case "em":
         return <em>{renderTokens((token as Tokens.Em).tokens)}</em>;
      case "del":
         return <del>{renderTokens((token as Tokens.Del).tokens)}</del>;
      case "codespan":
         return <code>{(token as Tokens.Codespan).text}</code>;
      case "br":
         return <br />;
      case "hr":
         return <hr />;
      case "code": {
         const { lang, text } = token as Tokens.Code;
         const language = lang?.trim().split(/\s+/)[0];
         return (
            <pre>
               <code className={language ? `language-${language}` : undefined}>
                  {text}
               </code>
            </pre>
         );
      }
      case "blockquote":
         return (
            <blockquote>
               {renderTokens((token as Tokens.Blockquote).tokens)}
            </blockquote>
         );
      case "list": {
         const { ordered, start, items } = token as Tokens.List;
         return createElement(
            ordered ? "ol" : "ul",
            {
               start:
                  ordered && start !== "" && start !== 1 ? start : undefined,
               className: items.some((item) => item.task)
                  ? "contains-task-list"
                  : undefined,
            },
            ...items.map((item, index) => (
               <li
                  key={index}
                  className={item.task ? "task-list-item" : undefined}
               >
                  {renderTokens(item.tokens)}
               </li>
            ))
         );
      }
      case "checkbox":
         return (
            <input
               type="checkbox"
               checked={(token as Tokens.Checkbox).checked}
               disabled
               readOnly
            />
         );
      case "table": {
         const { header, rows } = token as Tokens.Table;
         return (
            <table>
               <thead>
                  <tr>
                     {header.map((cell, index) => (
                        <Cell key={index} cell={cell} row="header" />
                     ))}
                  </tr>
               </thead>
               <tbody>
                  {rows.map((row, rowIndex) => (
                     <tr key={rowIndex}>
                        {row.map((cell, index) => (
                           <Cell key={index} cell={cell} row="body" />
                        ))}
                     </tr>
                  ))}
               </tbody>
            </table>
         );
      }
      case "link": {
         const { href, title, tokens } = token as Tokens.Link;
         const url = safeUrl(href, SAFE_LINK);
         const label = renderTokens(tokens);
         if (!url) return label;
         return (
            <a
               href={url}
               title={title ?? undefined}
               target="_blank"
               rel="noopener noreferrer nofollow"
            >
               <InsideLink.Provider value={true}>{label}</InsideLink.Provider>
            </a>
         );
      }
      case "image": {
         const image = token as Tokens.Image;
         const { title, text } = image;
         const remote = remoteImage(image);
         if (!remote) return text;
         return (
            <RemoteImage
               url={remote.url}
               host={remote.host}
               alt={decodeEntities(text)}
               title={title ?? undefined}
            />
         );
      }
      // raw html, link definitions and blank lines never reach the page
      default:
         return null;
   }
};

const HiddenImages = ({ hosts }: { hosts: readonly string[] }) => {
   const { allowed, allow } = useContext(RemoteImagesContext);
   const hidden = hosts.filter((host) => !allowed.has(host));
   if (hidden.length === 0) return null;
   return (
      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-md border border-viewerborder bg-viewergray px-3 py-2 text-xs text-viewertext">
         <ImageIcon className="size-3.5 shrink-0" aria-hidden="true" />
         <span className="mr-auto">
            {pluralize(hidden.length, "remote image")} not loaded
         </span>
         {[...new Set(hidden)].map((host) => (
            <Button
               key={host}
               type="button"
               variant="outline"
               size="sm"
               className="max-w-full"
               onClick={() => allow(host)}
            >
               <span className="truncate">Load from {host}</span>
            </Button>
         ))}
      </div>
   );
};

const MarkdownContent = ({ text }: { text: string }) => {
   const tokens = useMemo(() => marked.lexer(text), [text]);
   const hosts = useMemo(() => imageHosts(tokens), [tokens]);
   const [allowed, setAllowed] = useState<ReadonlySet<string>>(new Set());
   const images = useMemo(
      () => ({
         allowed,
         allow: (host: string) =>
            setAllowed((hosts) => new Set(hosts).add(host)),
      }),
      [allowed]
   );
   return (
      <RemoteImagesContext.Provider value={images}>
         <HiddenImages hosts={hosts} />
         {renderTokens(tokens)}
      </RemoteImagesContext.Provider>
   );
};

export { MarkdownContent };
