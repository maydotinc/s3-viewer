import {
   Avatar,
   Btn,
   C,
   Card,
   Chip,
   CloudflareGlyph,
   Cursor,
   Field,
   FlowLine,
   Glide,
   HR,
   HeaderRow,
   Icon,
   IllustrationFrame,
   Motion,
   ObjectRow,
   ProviderTile,
   SVGRoot,
   Toggle,
   Txt,
   type Provider,
} from "./shared";

const SearchBox = ({
   x,
   y,
   w,
   h = 28,
}: {
   x: number;
   y: number;
   w: number;
   h?: number;
}) => (
   <Field x={x} y={y} w={w} h={h}>
      <Icon name="search" x={9} y={h / 2 - 7} size={14} color={C.light} />
      <Txt x={28} y={h / 2 + 4} size={11.5} fill={C.light}>
         Search…
      </Txt>
   </Field>
);

const SERVERS: { name: string; sub: string; provider: Provider }[] = [
   { name: "May Inc.", sub: "Cloudflare R2 · auto", provider: "cloudflare" },
   { name: "Backup S3", sub: "Amazon S3 · us-east-1", provider: "aws" },
   { name: "Lab MinIO", sub: "MinIO · self-hosted", provider: "server" },
];

const BUCKETS = ["barberflow", "s3-viewer", "pastsmalltalk", "crayo"];

export const MultiCloudIllustration = () => (
   <IllustrationFrame>
      <SVGRoot>
         <Txt x={24} y={70} size={10} fill={C.light} caps>
            SERVERS
         </Txt>
         <path
            d="M184 252C220 252 220 180 256 180"
            stroke={C.border}
            strokeWidth={1.5}
            strokeDasharray="4 4"
         />
         <path
            d="M184 180H256"
            stroke={C.border}
            strokeWidth={1.5}
            strokeDasharray="4 4"
         />
         <FlowLine d="M184 108C220 108 220 180 256 180" />
         {SERVERS.map((s, i) => {
            const active = i === 0;
            return (
               <Card
                  key={s.name}
                  x={24}
                  y={84 + i * 72}
                  w={160}
                  h={48}
                  stroke={active ? C.blue : C.border}
               >
                  <ProviderTile x={12} y={12} provider={s.provider} />
                  <Txt x={44} y={22} weight={600} fill={C.black}>
                     {s.name}
                  </Txt>
                  <Txt x={44} y={36} size={10} fill={C.light}>
                     {s.sub}
                  </Txt>
                  <circle
                     cx={146}
                     cy={24}
                     r={3.5}
                     fill={active ? C.blue : C.white}
                     stroke={active ? C.blue : C.border}
                     strokeWidth={1.25}
                  />
               </Card>
            );
         })}
         <Card x={256} y={56} w={200} h={248}>
            <ProviderTile x={12} y={8} provider="cloudflare" />
            <Txt x={44} y={25} weight={600} fill={C.black}>
               May Inc.
            </Txt>
            <Icon name="chevronsUpDown" x={172} y={12} color={C.light} />
            <HR x={0} y={40} w={200} />
            <HeaderRow
               x={0}
               y={40}
               w={200}
               cols={[{ label: "Bucket", x: 12 }]}
            />
            {BUCKETS.map((b, i) => (
               <ObjectRow
                  key={b}
                  x={0}
                  y={64 + i * 36}
                  w={200}
                  h={36}
                  name={b}
                  kind="folder"
               >
                  <Icon name="chevronRight" x={174} y={10} color={C.light} />
               </ObjectRow>
            ))}
            <Txt x={12} y={232} size={10.5} fill={C.light}>
               4 buckets · one server at a time
            </Txt>
         </Card>
      </SVGRoot>
   </IllustrationFrame>
);

export const ShareNonTechnicalIllustration = () => (
   <IllustrationFrame>
      <SVGRoot>
         <Card x={24} y={66} w={192} h={192}>
            <Avatar x={28} y={26} initials="M" />
            <Txt x={48} y={23} weight={600} fill={C.black}>
               Mike Chen
            </Txt>
            <Txt x={48} y={37} size={10} fill={C.light}>
               via S3 Viewer
            </Txt>
            <HR x={0} y={52} w={192} />
            <Txt x={16} y={76} size={11}>
               You&apos;ve been invited to view
            </Txt>
            <Txt x={16} y={96} weight={600} fill={C.black} mono>
               client-deliverables
            </Txt>
            <Txt x={16} y={124} size={11} fill={C.light}>
               Role
            </Txt>
            <Chip x={44} y={110} w={56} label="Viewer" />
            <Btn x={16} y={144} w={108} label="Open bucket" />
            <Txt x={16} y={186} size={10} fill={C.light}>
               No AWS account needed
            </Txt>
         </Card>
         <path
            d="M216 168H248"
            stroke={C.light}
            strokeWidth={1.25}
            strokeDasharray="3 4"
         />
         <path
            d="M244 164l4 4-4 4"
            stroke={C.light}
            strokeWidth={1.25}
            strokeLinecap="round"
         />
         <Card x={252} y={42} w={204} h={256}>
            <Txt x={12} y={24} weight={600} fill={C.black}>
               client-deliverables
            </Txt>
            <Chip x={128} y={10} w={64} label="Read only" />
            <HR x={0} y={40} w={204} />
            <SearchBox x={12} y={52} w={180} h={24} />
            <HeaderRow
               x={0}
               y={88}
               w={204}
               h={22}
               cols={[
                  { label: "Name", x: 12 },
                  { label: "Size", x: 140 },
               ]}
            />
            <ObjectRow
               x={0}
               y={110}
               w={204}
               h={30}
               name="brand-deck.pdf"
               size="4.2 MB"
               sizeX={140}
            />
            <ObjectRow
               x={0}
               y={140}
               w={204}
               h={30}
               name="q3-report.pdf"
               size="1.1 MB"
               sizeX={140}
            />
            <ObjectRow
               x={0}
               y={170}
               w={204}
               h={30}
               name="photos/"
               kind="folder"
            />
            <ObjectRow
               x={0}
               y={200}
               w={204}
               h={30}
               name="contract.pdf"
               size="380 KB"
               sizeX={140}
            />
            <Txt x={12} y={246} size={10} fill={C.light}>
               View and download only
            </Txt>
         </Card>
         <Toggle x={24} y={290} />
         <Txt x={68} y={299} size={11} weight={600} fill={C.black}>
            Sharing on
         </Txt>
         <Txt x={68} y={313} size={10} fill={C.light}>
            Flip it to revoke instantly
         </Txt>
         <Motion still={<Cursor x={128} y={226} />}>
            <g>
               <Glide values="72 84;0 0;0 0" keyTimes="0;.45;1" dur="4.5s" />
               <Cursor x={128} y={226} />
            </g>
         </Motion>
      </SVGRoot>
   </IllustrationFrame>
);

const MEMBERS = [
   { i: "AR", name: "Aleem Rehmtulla", mail: "aleem@acme.com", role: "Owner" },
   { i: "DK", name: "Dana Kim", mail: "dana@acme.com", role: "Editor" },
   { i: "JP", name: "Jonas Park", mail: "jonas@acme.com", role: "Viewer" },
];

export const TeamsIllustration = () => (
   <IllustrationFrame>
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
               <Motion
                  still={
                     <circle
                        cx={28}
                        cy={22}
                        r={12}
                        stroke={C.light}
                        strokeWidth={1.25}
                        strokeDasharray="3 3"
                     />
                  }
               >
                  <circle
                     cx={28}
                     cy={22}
                     r={12}
                     stroke={C.light}
                     strokeWidth={1.25}
                     strokeDasharray="3 3"
                  >
                     <animateTransform
                        attributeName="transform"
                        type="rotate"
                        from="0 28 22"
                        to="360 28 22"
                        dur="9s"
                        repeatCount="indefinite"
                     />
                  </circle>
               </Motion>
               <Icon
                  name="mail"
                  x={20}
                  y={14}
                  size={16}
                  color={C.light}
                  sw={1.3}
               />
               <Txt x={52} y={19} fill={C.light}>
                  sam@client.com
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

const FILES: [string, string][] = [
   ["animated.gif", "1.88 MB"],
   ["clip.mp4", "15.95 MB"],
   ["compressed.zip", "487.53 KB"],
   ["export.mp4", "80.25 MB"],
   ["image.png", "93.03 KB"],
   ["laughing.gif", "122.3 KB"],
];

const MenuItem = ({
   y,
   icon,
   label,
   danger,
}: {
   y: number;
   icon: "pencil" | "link" | "download" | "trash";
   label: string;
   danger?: boolean;
}) => (
   <g transform={`translate(0 ${y})`}>
      <Icon
         name={icon}
         x={12}
         y={6}
         size={14}
         color={danger ? C.red : C.text}
      />
      <Txt x={34} y={18} size={12} fill={danger ? C.red : C.black}>
         {label}
      </Txt>
   </g>
);

export const S3BrowserIllustration = () => (
   <IllustrationFrame>
      <SVGRoot>
         <Card x={24} y={28} w={432} h={304}>
            <SearchBox x={12} y={12} w={144} />
            <Btn x={164} y={12} w={96} label="Rows (100)" kind="ghost" />
            <Icon name="chevronDown" x={240} y={18} size={14} color={C.light} />
            <Btn x={356} y={12} w={64} label="New" kind="primary" icon="plus" />
            <HeaderRow
               x={0}
               y={52}
               w={432}
               check="none"
               cols={[
                  { label: "Name", x: 56 },
                  { label: "Size", x: 232 },
                  { label: "Modified", x: 312 },
               ]}
            />
            <ObjectRow
               x={0}
               y={76}
               w={432}
               name="backup/"
               kind="folder"
               sizeX={232}
            />
            {FILES.map(([n, s], i) => (
               <ObjectRow
                  key={n}
                  x={0}
                  y={108 + i * 32}
                  w={432}
                  name={n}
                  size={s}
                  date="2026-09-05"
                  sizeX={232}
                  dateX={312}
                  check={i === 1}
                  selected={i === 1}
                  menu
               />
            ))}
            <Card x={216} y={152} w={140} h={130} shadow>
               <Motion
                  still={
                     <rect
                        x={4}
                        y={6}
                        width={132}
                        height={28}
                        rx={6}
                        fill={C.gray}
                     />
                  }
               >
                  <g>
                     <Glide
                        values="0 0;0 0;0 28;0 28;0 56;0 56;0 0"
                        keyTimes="0;.3;.36;.6;.66;.92;1"
                        dur="6s"
                     />
                     <rect
                        x={4}
                        y={6}
                        width={132}
                        height={28}
                        rx={6}
                        fill={C.gray}
                     />
                  </g>
               </Motion>
               <MenuItem y={6} icon="pencil" label="Rename" />
               <MenuItem y={34} icon="link" label="Copy link" />
               <MenuItem y={62} icon="download" label="Download" />
               <HR x={0} y={94} w={140} />
               <MenuItem y={98} icon="trash" label="Delete" danger />
            </Card>
         </Card>
         <Motion still={<Cursor x={324} y={194} />}>
            <g>
               <Glide
                  values="0 0;0 0;0 28;0 28;0 56;0 56;0 0"
                  keyTimes="0;.3;.36;.6;.66;.92;1"
                  dur="6s"
               />
               <Cursor x={324} y={194} />
            </g>
         </Motion>
      </SVGRoot>
   </IllustrationFrame>
);

export const CloudflareR2Illustration = () => (
   <IllustrationFrame>
      <SVGRoot>
         <Motion
            still={
               <g>
                  <path d="M176 168H272" stroke={C.blue} strokeWidth={2} />
                  <rect
                     x={270}
                     y={159}
                     width={16}
                     height={18}
                     rx={3}
                     fill={C.blue}
                  />
                  <path
                     d="M286 164h10M286 172h10"
                     stroke={C.blue}
                     strokeWidth={2}
                     strokeLinecap="round"
                  />
               </g>
            }
         >
            <g>
               <Glide values="-28 0;0 0;0 0" keyTimes="0;.3;1" dur="5s" />
               <FlowLine d="M176 168H272" width={2} />
               <rect
                  x={270}
                  y={159}
                  width={16}
                  height={18}
                  rx={3}
                  fill={C.blue}
               />
               <path
                  d="M286 164h10M286 172h10"
                  stroke={C.blue}
                  strokeWidth={2}
                  strokeLinecap="round"
               />
            </g>
         </Motion>
         <Card x={8} y={96} w={184} h={144}>
            <rect x={16} y={16} width={40} height={40} rx={8} fill={C.gray} />
            <CloudflareGlyph x={22} y={22} size={28} />
            <Txt x={68} y={32} size={13} weight={600} fill={C.black}>
               Cloudflare R2
            </Txt>
            <Txt x={68} y={47} size={10.5} fill={C.light}>
               May Inc.
            </Txt>
            <HR x={0} y={68} w={184} />
            <Txt x={16} y={86} size={10} fill={C.light} caps>
               ENDPOINT
            </Txt>
            <Txt x={16} y={101} size={9} fill={C.black} mono>
               acme.r2.cloudflarestorage.com
            </Txt>
            <Chip x={16} y={114} w={88} label="region · auto" mono size={10} />
            <Chip x={112} y={114} w={48} label="S3 API" mono size={10} />
         </Card>
         <Chip x={196} y={132} w={88} label="S3-compatible" size={10} />
         <Txt x={240} y={198} size={10} fill={C.light} anchor="middle">
            no code changes
         </Txt>
         <Card x={296} y={48} w={168} h={264}>
            <ProviderTile x={12} y={8} provider="cloudflare" />
            <Txt x={44} y={25} weight={600} fill={C.black}>
               May Inc.
            </Txt>
            <Icon name="chevronsUpDown" x={140} y={12} color={C.light} />
            <HR x={0} y={40} w={168} />
            <SearchBox x={12} y={48} w={96} h={24} />
            <Btn x={116} y={48} w={40} h={24} label="New" />
            <HeaderRow
               x={0}
               y={84}
               w={168}
               h={22}
               cols={[{ label: "Bucket name", x: 12 }]}
            />
            {BUCKETS.map((b, i) => (
               <ObjectRow
                  key={b}
                  x={0}
                  y={106 + i * 34}
                  w={168}
                  h={34}
                  name={b}
                  kind="folder"
               >
                  <Icon name="chevronRight" x={142} y={9} color={C.light} />
               </ObjectRow>
            ))}
            <Txt x={12} y={258} size={10} fill={C.light}>
               4 buckets · connected
            </Txt>
         </Card>
         <rect
            x={292}
            y={156}
            width={8}
            height={24}
            rx={2}
            fill={C.gray}
            stroke={C.border}
            strokeWidth={1.25}
         />
      </SVGRoot>
   </IllustrationFrame>
);

const Shackle = () => (
   <path
      d="M352 54V48a8 8 0 0 1 16 0v6"
      stroke={C.blue}
      strokeWidth={2}
      strokeLinecap="round"
   />
);

const Endpoint = ({
   x,
   y,
   icon,
   label,
}: {
   x: number;
   y: number;
   icon: "monitor" | "server";
   label: string;
}) => (
   <g transform={`translate(${x} ${y})`}>
      <rect
         width={32}
         height={32}
         rx={8}
         fill={C.white}
         stroke={C.border}
         strokeWidth={1.25}
      />
      <Icon
         name={icon}
         x={8}
         y={8}
         color={C.text}
         sw={icon === "server" ? 1 : 1.4}
      />
      <Txt x={16} y={50} size={10} fill={C.text} anchor="middle">
         {label}
      </Txt>
   </g>
);

export const SecurityIllustration = () => (
   <IllustrationFrame>
      <SVGRoot>
         <path
            d="M96 164H384"
            stroke={C.border}
            strokeWidth={1.25}
            strokeDasharray="3 4"
         />
         <Endpoint x={64} y={148} icon="monitor" label="Browser" />
         <Endpoint x={384} y={148} icon="server" label="Server" />
         <Card x={112} y={48} w={256} h={232}>
            <Txt x={20} y={32} size={13} weight={600} fill={C.black}>
               Connect a server
            </Txt>
            <Txt x={20} y={48} size={10.5} fill={C.light}>
               Credentials are encrypted before
            </Txt>
            <Txt x={20} y={62} size={10.5} fill={C.light}>
               they leave your browser.
            </Txt>
            <Txt x={20} y={90} size={11} fill={C.black}>
               Access key ID
            </Txt>
            <Field x={20} y={98} w={216}>
               <Txt x={10} y={18} size={11} fill={C.black} mono>
                  AKIA •••• •••• 8F2A
               </Txt>
               <Icon
                  name="lock"
                  x={192}
                  y={7}
                  size={14}
                  color={C.light}
                  sw={1.3}
               />
            </Field>
            <Txt x={20} y={146} size={11} fill={C.black}>
               Secret access key
            </Txt>
            <Field x={20} y={154} w={216}>
               <Txt x={10} y={18} size={11} fill={C.light} mono>
                  •••• •••• •••• ••••
               </Txt>
               <Icon
                  name="lock"
                  x={192}
                  y={7}
                  size={14}
                  color={C.light}
                  sw={1.3}
               />
            </Field>
            <Chip
               x={20}
               y={196}
               w={128}
               label="Encrypted in browser"
               size={10.5}
            />
            <Btn x={160} y={192} w={76} label="Continue" />
         </Card>
         <circle
            cx={360}
            cy={64}
            r={22}
            fill={C.white}
            stroke={C.border}
            strokeWidth={1.25}
         />
         <rect x={350} y={62} width={20} height={14} rx={3} fill={C.blue} />
         <circle cx={360} cy={68} r={1.6} fill={C.white} />
         <Motion still={<Shackle />}>
            <g>
               <Glide values="0 -5;0 0;0 0" keyTimes="0;.25;1" dur="5s" />
               <Shackle />
            </g>
         </Motion>
         <Chip x={84} y={300} w={80} label="MIT license" />
         <Chip x={172} y={300} w={92} label="Self-hostable" />
         <Chip x={272} y={300} w={124} label="Zero object retention" />
      </SVGRoot>
   </IllustrationFrame>
);
