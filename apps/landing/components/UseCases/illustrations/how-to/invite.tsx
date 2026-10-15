import {
   Avatar,
   Btn,
   C,
   Card,
   Chip,
   Field,
   IllustrationFrame,
   Motion,
   SVGRoot,
   Txt,
} from "../shared";
import { ILLUSTRATION_LABELS } from "../labels";

const STEPS = ["Who", "Where", "Access", "Review"];

const Envelope = () => (
   <g>
      <rect
         x={-22}
         y={-14}
         width={44}
         height={28}
         rx={4}
         fill={C.white}
         stroke={C.text}
         strokeWidth={1.25}
      />
      <path
         d="M-22 -14 0 4 22 -14"
         stroke={C.text}
         strokeWidth={1.25}
         strokeLinejoin="round"
      />
   </g>
);

export const InviteIllustration = () => (
   <IllustrationFrame label={ILLUSTRATION_LABELS.invite}>
      <SVGRoot>
         <Card x={32} y={36} w={256} h={256}>
            <Txt x={20} y={32} size={13} weight={600} fill={C.black}>
               Invite people
            </Txt>
            {STEPS.map((step, index) => {
               const current = index === STEPS.length - 1;
               return (
                  <Chip
                     key={step}
                     x={20 + index * 56}
                     y={46}
                     w={48}
                     label={step}
                     size={10}
                     fill={current ? C.blue : C.gray}
                     color={current ? C.white : C.text}
                  />
               );
            })}
            <Txt x={20} y={96} size={11} fill={C.black}>
               People
            </Txt>
            <Field x={20} y={104} w={216}>
               <Txt x={10} y={18} fill={C.black}>
                  dana@acme.com
               </Txt>
            </Field>
            <Txt x={20} y={150} size={11} fill={C.black}>
               Access
            </Txt>
            <Field x={20} y={158} w={216}>
               <Txt x={10} y={18} fill={C.black}>
                  media-archive
               </Txt>
               <Txt x={206} y={18} size={11} fill={C.light} anchor="end">
                  Editor
               </Txt>
            </Field>
            <Btn x={140} y={212} w={96} label="Send invite" />
         </Card>
         <path
            d="M300 262C360 262 416 252 416 216"
            stroke={C.border}
            strokeWidth={1.25}
            strokeDasharray="3 4"
         />
         <Avatar x={416} y={112} initials="DK" r={20} />
         <Txt x={416} y={150} weight={600} fill={C.black} anchor="middle">
            Dana Kim
         </Txt>
         <Txt x={416} y={165} size={11} fill={C.light} anchor="middle">
            Editor · media-archive
         </Txt>
         <Motion
            still={
               <g transform="translate(416 216)">
                  <Envelope />
               </g>
            }
         >
            <g>
               <animateMotion
                  path="M300 262C360 262 416 252 416 216"
                  keyPoints="0;1;1"
                  keyTimes="0;.55;1"
                  calcMode="linear"
                  dur="4.5s"
                  repeatCount="indefinite"
               />
               <Envelope />
            </g>
         </Motion>
         <Txt x={32} y={324} size={10.5} fill={C.light}>
            No IAM user, no access keys. Revoke in one click.
         </Txt>
      </SVGRoot>
   </IllustrationFrame>
);
