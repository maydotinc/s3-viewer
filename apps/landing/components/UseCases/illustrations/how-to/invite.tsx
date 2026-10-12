import {
   Avatar,
   Btn,
   C,
   Card,
   Field,
   Icon,
   IllustrationFrame,
   Motion,
   SVGRoot,
   Txt,
} from "../shared";
import { ILLUSTRATION_LABELS } from "../labels";

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
               Invite to media-archive
            </Txt>
            <Txt x={20} y={48} size={10.5} fill={C.light}>
               They get an email link, no AWS account.
            </Txt>
            <Txt x={20} y={80} size={11} fill={C.black}>
               Email
            </Txt>
            <Field x={20} y={88} w={216}>
               <Txt x={10} y={18} fill={C.black}>
                  dana@acme.com
               </Txt>
            </Field>
            <Txt x={20} y={136} size={11} fill={C.black}>
               Role
            </Txt>
            <Field x={20} y={144} w={216}>
               <Txt x={10} y={18} fill={C.black}>
                  Editor
               </Txt>
               <Icon name="chevronDown" x={192} y={6} color={C.light} />
            </Field>
            <Txt x={20} y={186} size={10} fill={C.light}>
               File editing where supported
            </Txt>
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
