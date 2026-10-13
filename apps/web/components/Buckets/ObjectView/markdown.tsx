import { marked, type Token, type Tokens } from "marked";
import { createElement, Fragment, useMemo, type ReactNode } from "react";

// presigned previews run on the storage origin's trust, so only destinations a browser can't script through survive
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
         return <strong>{renderTokens((token as Tokens.Strong).tokens)}</strong>;
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
               start: ordered && start !== "" && start !== 1 ? start : undefined,
               className: items.some((item) => item.task)
                  ? "contains-task-list"
                  : undefined,
            },
            ...items.map((item, index) => (
               <li key={index} className={item.task ? "task-list-item" : undefined}>
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
               {label}
            </a>
         );
      }
      case "image": {
         const { href, title, text } = token as Tokens.Image;
         const url = safeUrl(href, SAFE_IMAGE);
         if (!url) return text;
         // sizes aren't known ahead of time, so next/image has nothing to lay out with
         return (
            // eslint-disable-next-line @next/next/no-img-element
            <img
               src={url}
               alt={text}
               title={title ?? undefined}
               loading="lazy"
               referrerPolicy="no-referrer"
            />
         );
      }
      // raw html, link definitions and blank lines never reach the page
      default:
         return null;
   }
};

const MarkdownContent = ({ text }: { text: string }) => {
   const tokens = useMemo(() => marked.lexer(text), [text]);
   return <>{renderTokens(tokens)}</>;
};

export { MarkdownContent };
