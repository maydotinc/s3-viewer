import {
   C,
   Card,
   Chip,
   Cursor,
   Fade,
   Glide,
   HR,
   Icon,
   IllustrationFrame,
   Motion,
   ObjectRow,
   SVGRoot,
   Txt,
} from "../shared";
import { ILLUSTRATION_LABELS } from "../labels";
import { Crumb } from "./parts";

const MENU_ITEMS = [
   { label: "Download", icon: "download" },
   { label: "Copy link", icon: "link" },
   { label: "Rename", icon: "pencil" },
] as const;

const Toast = () => (
   <g transform="translate(248 280)">
      <rect width={208} height={52} rx={8} fill={C.blue} />
      <Icon name="check" x={12} y={10} color={C.white} sw={1.8} />
      <Txt x={36} y={23} weight={600} fill={C.white}>
         Link copied
      </Txt>
      <Txt x={36} y={40} size={9.5} fill={C.white} mono opacity={0.75}>
         …pdf?X-Amz-Expires=900&amp;…
      </Txt>
   </g>
);

export const ShareLinkIllustration = () => (
   <IllustrationFrame label={ILLUSTRATION_LABELS.shareLink}>
      <SVGRoot>
         <Card x={24} y={36} w={272} h={160}>
            <Crumb x={16} y={18} path="client-deliverables / " current="" />
            <HR x={0} y={28} w={272} />
            <ObjectRow
               x={0}
               y={28}
               w={272}
               name="brand-deck.pdf"
               size="4.2 MB"
               sizeX={172}
               menu
            />
            <ObjectRow
               x={0}
               y={60}
               w={272}
               name="q3-report.pdf"
               size="1.1 MB"
               sizeX={172}
               hover
               menu
            />
            <ObjectRow
               x={0}
               y={92}
               w={272}
               name="logo-final.png"
               size="93 KB"
               sizeX={172}
               menu
            />
            <ObjectRow
               x={0}
               y={124}
               w={272}
               name="contract.pdf"
               size="380 KB"
               sizeX={172}
               menu
            />
         </Card>
         <Card x={248} y={96} w={168} h={128}>
            {MENU_ITEMS.map(({ label, icon }, index) => (
               <g key={label} transform={`translate(0 ${6 + index * 28})`}>
                  {icon === "link" && (
                     <rect x={4} width={160} height={28} rx={5} fill={C.gray} />
                  )}
                  <Icon name={icon} x={12} y={7} size={14} color={C.text} />
                  <Txt x={34} y={18} size={11} fill={C.black}>
                     {label}
                  </Txt>
               </g>
            ))}
            <HR x={0} y={94} w={168} />
            <g transform="translate(0 94)">
               <Icon name="trash" x={12} y={9} size={14} color={C.red} />
               <Txt x={34} y={20} size={11} fill={C.red}>
                  Delete
               </Txt>
            </g>
         </Card>
         <Cursor x={330} y={140} />
         <Chip x={24} y={252} w={96} label="Presigned URL" mono size={10} />
         <Chip x={128} y={252} w={112} label="No account needed" />
         <Txt x={24} y={296} size={10.5} fill={C.light}>
            For ongoing access, send an email invite.
         </Txt>
         <Motion still={<Toast />}>
            <g>
               <Glide
                  values="0 10;0 0;0 0;0 10"
                  keyTimes="0;.12;.88;1"
                  dur="5s"
               />
               <Fade values="0;1;1;0" keyTimes="0;.12;.88;1" dur="5s" />
               <Toast />
            </g>
         </Motion>
      </SVGRoot>
   </IllustrationFrame>
);
