import {
   Avatar,
   Btn,
   C,
   Card,
   Chip,
   HR,
   HeaderRow,
   Icon,
   IllustrationFrame,
   SVGRoot,
   Spin,
   Txt,
} from "../shared";
import { ILLUSTRATION_LABELS } from "../labels";

const MEMBERS = [
   { i: "AR", name: "Aleem Rehmtulla", mail: "aleem@acme.com", role: "Owner" },
   { i: "DK", name: "Dana Kim", mail: "dana@acme.com", role: "Editor" },
   { i: "JP", name: "Jonas Park", mail: "jonas@acme.com", role: "Viewer" },
];

export const TeamsIllustration = () => (
   <IllustrationFrame label={ILLUSTRATION_LABELS.teams}>
      <SVGRoot>
         <Card x={32} y={24} w={416} h={256}>
            <Txt x={16} y={24} size={13} weight={600} fill={C.black}>
               Members
            </Txt>
            <Txt x={16} y={38} size={10.5} fill={C.light}>
               media-archive · 3 members, 1 pending
            </Txt>
            <Btn x={296} y={10} w={104} label="Invite people" />
            <HR x={0} y={48} w={416} />
            <HeaderRow
               x={0}
               y={48}
               w={416}
               cols={[
                  { label: "Name", x: 16 },
                  { label: "Role", x: 296 },
               ]}
            />
            {MEMBERS.map((m, idx) => {
               const y = 72 + idx * 44;
               const hovered = idx === 1;
               return (
                  <g key={m.i} transform={`translate(0 ${y})`}>
                     {hovered && <rect width={416} height={44} fill={C.gray} />}
                     <Avatar
                        x={28}
                        y={22}
                        initials={m.i}
                        fill={idx === 0 ? C.blue : C.text}
                     />
                     <Txt x={52} y={19} weight={600} fill={C.black}>
                        {m.name}
                     </Txt>
                     <Txt x={52} y={33} size={10.5} fill={C.light}>
                        {m.mail}
                     </Txt>
                     <Txt x={296} y={26}>
                        {m.role}
                     </Txt>
                     {hovered ? (
                        <Txt x={400} y={26} size={11} weight={600} anchor="end">
                           Remove
                        </Txt>
                     ) : (
                        <Icon
                           name="kebab"
                           x={382}
                           y={14}
                           color={C.light}
                           sw={1}
                        />
                     )}
                     <HR x={0} y={44} w={416} />
                  </g>
               );
            })}
            <g transform="translate(0 204)">
               <circle
                  cx={28}
                  cy={22}
                  r={12}
                  stroke={C.light}
                  strokeWidth={1.25}
                  strokeDasharray="3 3"
               >
                  <Spin cx={28} cy={22} dur="9s" />
               </circle>

               <Icon
                  name="mail"
                  x={20}
                  y={14}
                  size={16}
                  color={C.light}
                  sw={1.3}
               />
               <Txt x={52} y={19} fill={C.light}>
                  sam@example.com
               </Txt>
               <Txt x={52} y={33} size={10.5} fill={C.light}>
                  Invited 2 days ago
               </Txt>
               <Txt x={296} y={26} fill={C.light}>
                  Viewer
               </Txt>
               <Chip x={336} y={12} w={64} label="Pending" />
            </g>
         </Card>
         <g transform="translate(32 300)">
            <Icon name="key" x={0} y={0} color={C.light} />
            <path
               d="M-1 17L17 -1"
               stroke={C.text}
               strokeWidth={1.5}
               strokeLinecap="round"
            />
            <Txt x={26} y={12} size={11}>
               No per-person IAM users or access keys
            </Txt>
            <Txt x={416} y={12} size={11} fill={C.light} anchor="end">
               Off-board in one click
            </Txt>
         </g>
      </SVGRoot>
   </IllustrationFrame>
);
