import {
   Avatar,
   C,
   Card,
   Chip,
   FlowLine,
   HR,
   Icon,
   IllustrationFrame,
   ObjectRow,
   SVGRoot,
   Txt,
} from "../shared";
import { ILLUSTRATION_LABELS } from "../labels";
import { Crumb } from "./parts";

const LEFT_W = 224;
const RIGHT_W = 184;

const TreeRow = ({
   y,
   name,
   depth = 0,
   shared,
   locked,
}: {
   y: number;
   name: string;
   depth?: number;
   shared?: boolean;
   locked?: boolean;
}) => (
   <g transform={`translate(0 ${y})`}>
      {shared && (
         <rect width={LEFT_W} height={32} fill={C.blue} opacity={0.06} />
      )}
      <Icon
         name={locked ? "lock" : "folder"}
         x={12 + depth * 20}
         y={8}
         color={locked ? C.light : C.blue}
         sw={1.4}
      />
      <Txt
         x={34 + depth * 20}
         y={20}
         fill={locked ? C.light : depth ? C.text : C.black}
         weight={shared ? 600 : 500}
         mono
         size={11.5}
      >
         {name}
      </Txt>
      {shared && (
         <Chip
            x={LEFT_W - 68}
            y={6}
            w={56}
            label="Shared"
            size={10}
            fill={C.blue}
            color={C.white}
         />
      )}
      {depth > 0 && !locked && (
         <Txt x={LEFT_W - 68} y={20} size={10} fill={C.light}>
            via parent
         </Txt>
      )}
      <HR x={0} y={32} w={LEFT_W} />
   </g>
);

export const ShareFolderIllustration = () => (
   <IllustrationFrame label={ILLUSTRATION_LABELS.shareFolder}>
      <SVGRoot>
         <FlowLine d="M248 120C260 120 260 120 272 120" />
         <circle cx={248} cy={120} r={3} fill={C.blue} />
         <circle cx={272} cy={120} r={3} fill={C.blue} />
         <Card x={24} y={40} w={LEFT_W} h={272}>
            <Icon name="bucket" x={12} y={12} color={C.blue} sw={1.4} />
            <Txt x={36} y={25} weight={600} fill={C.black}>
               media-archive
            </Txt>
            <Chip
               x={LEFT_W - 100}
               y={10}
               w={88}
               label="Specific folders"
               size={10}
            />
            <HR x={0} y={40} w={LEFT_W} />
            <Txt x={12} y={58} size={10} fill={C.light} caps>
               FOLDERS
            </Txt>
            <TreeRow y={64} name="landing/" shared />
            <TreeRow y={96} name="images/" depth={1} />
            <TreeRow y={128} name="drafts/" depth={1} />
            <TreeRow y={160} name="reports/" locked />
            <TreeRow y={192} name="backups/" locked />
            <Txt x={12} y={262} size={10.5} fill={C.light}>
               A parent folder covers its children
            </Txt>
         </Card>
         <Card x={272} y={40} w={RIGHT_W} h={272}>
            <Avatar x={22} y={20} initials="DK" r={10} />
            <Txt x={38} y={24} weight={600} fill={C.black}>
               Dana Kim
            </Txt>
            <Chip x={RIGHT_W - 64} y={10} w={52} label="Viewer" size={10} />
            <HR x={0} y={40} w={RIGHT_W} />
            <Crumb x={12} y={58} path="" current="media-archive /" />
            <ObjectRow x={0} y={66} w={RIGHT_W} name="landing/" kind="folder">
               <Icon
                  name="chevronRight"
                  x={RIGHT_W - 26}
                  y={8}
                  color={C.light}
               />
            </ObjectRow>
            <rect
               x={12}
               y={112}
               width={RIGHT_W - 24}
               height={120}
               rx={6}
               stroke={C.border}
               strokeWidth={1.25}
               strokeDasharray="3 4"
            />
            <Txt
               x={RIGHT_W / 2}
               y={168}
               size={10.5}
               fill={C.light}
               anchor="middle"
            >
               Nothing else is listed
            </Txt>
            <Txt
               x={RIGHT_W / 2}
               y={184}
               size={10.5}
               fill={C.light}
               anchor="middle"
            >
               or openable
            </Txt>
            <Txt x={12} y={262} size={10.5} fill={C.light}>
               What Dana sees
            </Txt>
         </Card>
         <Txt x={24} y={338} size={10.5} fill={C.light}>
            Checked on the server before any request is signed.
         </Txt>
      </SVGRoot>
   </IllustrationFrame>
);
