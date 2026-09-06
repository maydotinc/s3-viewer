import {
   Avatar,
   Btn,
   C,
   Card,
   Caret,
   Chip,
   Cursor,
   DashLine,
   Fade,
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
   Txt,
   type Provider,
} from "./shared";

const Crumb = ({
   x,
   y,
   path,
   current,
}: {
   x: number;
   y: number;
   path: string;
   current: string;
}) => (
   <text x={x} y={y} fontSize={11} fontWeight={500} fill={C.light}>
      {path}
      <tspan fill={C.black}>{current}</tspan>
   </text>
);

const Step = ({ x, y, n }: { x: number; y: number; n: string }) => (
   <g transform={`translate(${x} ${y})`}>
      <circle r={9} fill={C.white} stroke={C.border} strokeWidth={1.25} />
      <Txt x={0} y={3.5} size={10} weight={600} fill={C.black} anchor="middle">
         {n}
      </Txt>
   </g>
);

const Arrow = ({
   x,
   y,
   w,
   label,
}: {
   x: number;
   y: number;
   w: number;
   label: string;
}) => (
   <g transform={`translate(${x} ${y})`}>
      <path d={`M0 0H${w}`} stroke={C.light} strokeWidth={1.25} />
      <path
         d={`M${w - 4} -4l4 4-4 4`}
         stroke={C.light}
         strokeWidth={1.25}
         strokeLinecap="round"
      />
      <Txt x={w / 2} y={-6} size={9.5} fill={C.blue} mono anchor="middle">
         {label}
      </Txt>
   </g>
);

export const RenameIllustration = () => (
   <IllustrationFrame>
      <SVGRoot>
         <Card x={32} y={38} w={416} h={136}>
            <Crumb x={16} y={18} path="media-archive / " current="reports /" />
            <HR x={0} y={28} w={416} />
            <ObjectRow
               x={0}
               y={28}
               w={416}
               name="q3-summary.pdf"
               size="1.2 MB"
               sizeX={300}
            />
            <g transform="translate(0 60)">
               <rect width={416} height={44} fill={C.gray} />
               <Icon name="file" x={12} y={14} color={C.light} sw={1.4} />
               <Field x={34} y={8} w={200} active>
                  <Txt x={10} y={18} fill={C.black} mono>
                     report-2026-09.pdf
                  </Txt>
                  <Caret x={142} y={7} />
               </Field>
               <Txt x={250} y={26} size={10} fill={C.light}>
                  Enter to save · Esc to cancel
               </Txt>
               <HR x={0} y={44} w={416} />
            </g>
            <ObjectRow
               x={0}
               y={104}
               w={416}
               name="slides.key"
               size="48 MB"
               sizeX={300}
            />
         </Card>
         <Card x={32} y={182} w={416} h={136}>
            <Txt x={16} y={24} size={10} fill={C.light} caps>
               UNDER THE HOOD
            </Txt>
            <Step x={25} y={50} n="1" />
            <Chip
               x={44}
               y={40}
               w={112}
               label="report-final.pdf"
               mono
               size={10}
            />
            <Arrow x={164} y={50} w={64} label="CopyObject" />
            <Chip
               x={236}
               y={40}
               w={128}
               label="report-2026-09.pdf"
               mono
               size={10}
               color={C.black}
            />
            <Step x={25} y={90} n="2" />
            <g opacity={0.55}>
               <Chip
                  x={44}
                  y={80}
                  w={112}
                  label="report-final.pdf"
                  mono
                  size={10}
               />
               <line
                  x1={54}
                  y1={90}
                  x2={146}
                  y2={90}
                  stroke={C.text}
                  strokeWidth={1}
               />
            </g>
            <Arrow x={164} y={90} w={64} label="DeleteObject" />
            <Icon name="trash" x={236} y={82} color={C.light} sw={1.4} />
            <Txt x={258} y={94} size={11} fill={C.light}>
               old key removed
            </Txt>
            <Txt x={16} y={122} size={10.5} fill={C.light}>
               Same bytes under a new key. Metadata and tags are preserved.
            </Txt>
         </Card>
      </SVGRoot>
   </IllustrationFrame>
);

export const ShareLinkIllustration = () => (
   <IllustrationFrame>
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
         <Card x={248} y={92} w={200} h={144}>
            <Txt x={16} y={26} weight={600} fill={C.black}>
               Share q3-report.pdf
            </Txt>
            <Field x={16} y={40} w={168}>
               <Txt x={10} y={18} size={10.5} fill={C.text} mono>
                  s3v.app/l/8f2a…q3
               </Txt>
               <Icon
                  name="copy"
                  x={144}
                  y={7}
                  size={14}
                  color={C.light}
                  sw={1.3}
               />
            </Field>
            <Icon
               name="clock"
               x={16}
               y={80}
               size={13}
               color={C.light}
               sw={1.3}
            />
            <Txt x={34} y={91} size={11} fill={C.light}>
               Expires in 15 min · read only
            </Txt>
            <Btn x={16} y={104} w={92} label="Copy link" icon="link" />
         </Card>
         <Cursor x={346} y={212} />
         <Chip x={24} y={252} w={96} label="Presigned URL" mono size={10} />
         <Chip x={128} y={252} w={112} label="No account needed" />
         <Txt x={24} y={296} size={10.5} fill={C.light}>
            For ongoing access, send an email invite.
         </Txt>
         <Motion
            still={
               <g transform="translate(272 288)">
                  <rect width={176} height={36} rx={8} fill={C.blue} />
                  <Icon name="check" x={12} y={10} color={C.white} sw={1.8} />
                  <Txt x={36} y={23} weight={600} fill={C.white}>
                     Link copied
                  </Txt>
                  <Txt
                     x={162}
                     y={23}
                     size={11}
                     fill={C.white}
                     mono
                     anchor="end"
                     opacity={0.75}
                  >
                     14:59
                  </Txt>
               </g>
            }
         >
            <g>
               <Glide
                  values="0 10;0 0;0 0;0 10"
                  keyTimes="0;.12;.88;1"
                  dur="5s"
               />
               <Fade values="0;1;1;0" keyTimes="0;.12;.88;1" dur="5s" />
               <g transform="translate(272 288)">
                  <rect width={176} height={36} rx={8} fill={C.blue} />
                  <Icon name="check" x={12} y={10} color={C.white} sw={1.8} />
                  <Txt x={36} y={23} weight={600} fill={C.white}>
                     Link copied
                  </Txt>
                  <Txt
                     x={162}
                     y={23}
                     size={11}
                     fill={C.white}
                     mono
                     anchor="end"
                     opacity={0.75}
                  >
                     14:59
                  </Txt>
               </g>
            </g>
         </Motion>
      </SVGRoot>
   </IllustrationFrame>
);

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
   <IllustrationFrame>
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
               Can upload, rename and delete objects
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

const PANE_ROWS: [string, string, "file" | "folder"][] = [
   ["2026-09/", "", "folder"],
   ["hero.mp4", "80.25 MB", "file"],
   ["logo.png", "93 KB", "file"],
   ["notes.md", "4.1 KB", "file"],
];

const Pane = ({
   x,
   provider,
   name,
   region,
}: {
   x: number;
   provider: Provider;
   name: string;
   region: string;
}) => (
   <Card x={x} y={34} w={204} h={264}>
      <ProviderTile x={12} y={10} provider={provider} />
      <Txt x={44} y={27} weight={600} fill={C.black}>
         {name}
      </Txt>
      <Chip x={120} y={12} w={72} label={region} mono size={10} />
      <HR x={0} y={44} w={204} />
      <Icon name="bucket" x={12} y={52} size={14} color={C.light} sw={1.3} />
      <Txt x={32} y={63} size={11} fill={C.black} mono>
         media-archive
      </Txt>
      <HeaderRow
         x={0}
         y={72}
         w={204}
         h={22}
         cols={[
            { label: "Name", x: 34 },
            { label: "Size", x: 132 },
         ]}
      />
      {PANE_ROWS.map(([n, s, k], i) => (
         <ObjectRow
            key={n}
            x={0}
            y={94 + i * 32}
            w={204}
            name={n}
            size={s || undefined}
            kind={k}
            sizeX={132}
         />
      ))}
      <Txt x={12} y={246} size={10} fill={C.light}>
         4 objects · 80.3 MB
      </Txt>
   </Card>
);

export const SideBySideIllustration = () => (
   <IllustrationFrame>
      <SVGRoot>
         <Pane x={16} provider="aws" name="Backup S3" region="us-east-1" />
         <Pane x={260} provider="cloudflare" name="May Inc." region="auto" />
         <circle
            cx={240}
            cy={166}
            r={18}
            fill={C.white}
            stroke={C.border}
            strokeWidth={1.25}
         />
         <Motion
            still={
               <Icon name="switch" x={232} y={158} color={C.blue} sw={1.6} />
            }
         >
            <g>
               <Glide
                  type="rotate"
                  values="0 240 166;0 240 166;180 240 166;180 240 166"
                  keyTimes="0;.4;.55;1"
                  dur="4s"
               />
               <Icon name="switch" x={232} y={158} color={C.blue} sw={1.6} />
            </g>
         </Motion>
         <Txt x={240} y={324} size={10.5} fill={C.light} anchor="middle">
            One credential per provider, one click apart
         </Txt>
      </SVGRoot>
   </IllustrationFrame>
);

const SIDEBAR_BUCKETS = ["s3-viewer", "pastsmalltalk", "crayo", "barberflow"];

const PALETTE: [string, string][] = [
   ["pastsmalltalk", "May Inc."],
   ["paper-archive", "Backup S3"],
   ["parity-logs", "Lab MinIO"],
];

export const SwitchBucketsIllustration = () => (
   <IllustrationFrame>
      <SVGRoot>
         <Card x={24} y={32} w={200} h={296}>
            <Txt x={12} y={24} size={10} fill={C.light} caps>
               SERVERS
            </Txt>
            <rect
               x={12}
               y={32}
               width={176}
               height={40}
               rx={8}
               fill={C.white}
               stroke={C.border}
               strokeWidth={1.25}
            />
            <circle cx={26} cy={52} r={3} fill={C.blue} />
            <ProviderTile x={38} y={40} provider="cloudflare" />
            <Txt x={70} y={56} weight={600} fill={C.black}>
               May Inc.
            </Txt>
            <Icon name="chevronsUpDown" x={160} y={44} color={C.light} />
            <Txt x={12} y={100} size={10} fill={C.light} caps>
               BUCKETS
            </Txt>
            <Motion
               still={
                  <rect
                     x={12}
                     y={144}
                     width={176}
                     height={36}
                     rx={6}
                     fill={C.gray}
                  />
               }
            >
               <g>
                  <Glide
                     values="0 -36;0 -36;0 0;0 0;0 36;0 36;0 -36;0 -36"
                     keyTimes="0;.28;.34;.6;.66;.92;.98;1"
                     dur="6s"
                  />
                  <rect
                     x={12}
                     y={144}
                     width={176}
                     height={36}
                     rx={6}
                     fill={C.gray}
                  />
               </g>
            </Motion>
            {SIDEBAR_BUCKETS.map((b, i) => (
               <g key={b} transform={`translate(12 ${108 + i * 36})`}>
                  <Icon name="folder" x={10} y={10} color={C.blue} sw={1.4} />
                  <Txt
                     x={34}
                     y={22}
                     fill={C.black}
                     weight={i === 1 ? 600 : 500}
                  >
                     {b}
                  </Txt>
                  <Icon name="chevronRight" x={152} y={10} color={C.light} />
               </g>
            ))}
            <HR x={12} y={264} w={176} />
            <Chip x={12} y={276} w={32} label="⌘K" mono />
            <Txt x={52} y={290} size={11}>
               Jump to any bucket
            </Txt>
         </Card>
         <Card x={256} y={80} w={200} h={180}>
            <Icon name="search" x={12} y={11} size={14} color={C.light} />
            <Txt x={34} y={22} fill={C.black} mono>
               pa
            </Txt>
            <Caret x={51} y={10} />
            <Chip x={156} y={8} w={32} label="⌘K" mono />
            <HR x={0} y={36} w={200} />
            <Txt x={12} y={56} size={10} fill={C.light} caps>
               BUCKETS
            </Txt>
            {PALETTE.map(([b, s], i) => (
               <g key={b} transform={`translate(0 ${64 + i * 32})`}>
                  {i === 0 && (
                     <rect
                        x={6}
                        y={0}
                        width={188}
                        height={32}
                        rx={6}
                        fill={C.blue}
                        opacity={0.08}
                     />
                  )}
                  <Icon
                     name="folder"
                     x={14}
                     y={8}
                     color={i === 0 ? C.blue : C.light}
                     sw={1.4}
                  />
                  <Txt x={38} y={20} fill={C.black}>
                     <tspan fill={C.blue} fontWeight={600}>
                        pa
                     </tspan>
                     {b.slice(2)}
                  </Txt>
                  <Txt x={188} y={20} size={10} fill={C.light} anchor="end">
                     {s}
                  </Txt>
               </g>
            ))}
            <Txt x={12} y={172} size={10} fill={C.light}>
               ↵ open · ↑↓ move · esc close
            </Txt>
         </Card>
      </SVGRoot>
   </IllustrationFrame>
);

const FlowNode = ({
   y,
   icon,
   title,
   sub,
   mono,
}: {
   y: number;
   icon: "monitor" | "server" | "bucket";
   title: string;
   sub: string;
   mono?: boolean;
}) => (
   <Card x={320} y={y} w={136} h={44}>
      <Icon
         name={icon}
         x={12}
         y={14}
         color={icon === "server" ? C.blue : C.text}
         sw={icon === "server" ? 1 : 1.4}
      />
      <Txt x={36} y={19} size={11} weight={600} fill={C.black} mono={mono}>
         {title}
      </Txt>
      <Txt x={36} y={33} size={10} fill={C.light}>
         {sub}
      </Txt>
   </Card>
);

export const UploadIllustration = () => (
   <IllustrationFrame>
      <SVGRoot>
         <Card
            x={24}
            y={44}
            w={272}
            h={168}
            dash="6 4"
            stroke={C.blue}
            shadow={false}
         >
            <Icon
               name="upload"
               x={120}
               y={36}
               size={32}
               color={C.blue}
               sw={0.9}
            />
            <Txt
               x={136}
               y={96}
               size={13}
               weight={600}
               fill={C.black}
               anchor="middle"
            >
               Drop files to upload
            </Txt>
            <Txt x={136} y={114} size={11} fill={C.light} anchor="middle">
               or click to browse
            </Txt>
         </Card>
         <Motion
            still={
               <Card x={92} y={168} w={140} h={32} rx={6}>
                  <Icon name="file" x={10} y={8} color={C.light} sw={1.4} />
                  <Txt x={32} y={20} size={11} fill={C.black}>
                     export.mp4
                  </Txt>
                  <Txt x={130} y={20} size={10} fill={C.light} anchor="end">
                     80 MB
                  </Txt>
               </Card>
            }
         >
            <g>
               <Glide values="-72 -96;0 0;0 0" keyTimes="0;.4;1" dur="5s" />
               <Card x={92} y={168} w={140} h={32} rx={6}>
                  <Icon name="file" x={10} y={8} color={C.light} sw={1.4} />
                  <Txt x={32} y={20} size={11} fill={C.black}>
                     export.mp4
                  </Txt>
                  <Txt x={130} y={20} size={10} fill={C.light} anchor="end">
                     80 MB
                  </Txt>
               </Card>
            </g>
         </Motion>
         <Card x={24} y={236} w={272} h={64}>
            <Icon name="file" x={12} y={12} color={C.light} sw={1.4} />
            <Txt x={36} y={24} fill={C.black}>
               export.mp4
            </Txt>
            <Txt
               x={260}
               y={24}
               size={11}
               weight={600}
               fill={C.blue}
               anchor="end"
            >
               62%
            </Txt>
            <Txt x={36} y={38} size={10} fill={C.light}>
               49.8 of 80.3 MB · multipart, part 8 of 13
            </Txt>
            <rect x={12} y={48} width={248} height={6} rx={3} fill={C.border} />
            <Motion
               still={
                  <rect
                     x={12}
                     y={48}
                     width={154}
                     height={6}
                     rx={3}
                     fill={C.blue}
                  />
               }
            >
               <g transform="translate(12 48)">
                  <rect width={248} height={6} rx={3} fill={C.blue}>
                     <Glide
                        type="scale"
                        values="0 1;.62 1;.62 1"
                        keyTimes="0;.55;1"
                        dur="5s"
                     />
                  </rect>
               </g>
            </Motion>
         </Card>
         <FlowNode
            y={52}
            icon="monitor"
            title="Your browser"
            sub="no keys here"
         />
         <DashLine d="M388 96V128" />
         <FlowNode
            y={128}
            icon="server"
            title="S3 Viewer server"
            sub="streams · retries"
         />
         <DashLine d="M388 172V204" />
         <FlowNode
            y={204}
            icon="bucket"
            title="media-archive"
            sub="no CORS setup"
            mono
         />
         <Chip
            x={320}
            y={268}
            w={136}
            label="Server-side streaming"
            size={10.5}
         />
         <Chip
            x={320}
            y={296}
            w={136}
            label="Multipart over 5 GB"
            size={10.5}
         />
      </SVGRoot>
   </IllustrationFrame>
);

const Landing = () => (
   <g>
      <Icon name="file" x={-8} y={-8} color={C.blue} sw={1.5} />
   </g>
);

export const DownloadIllustration = () => (
   <IllustrationFrame>
      <SVGRoot>
         <Card x={24} y={52} w={288} h={140}>
            <Crumb x={16} y={18} path="media-archive / " current="exports /" />
            <HR x={0} y={28} w={288} />
            <ObjectRow
               x={0}
               y={28}
               w={288}
               h={40}
               name="report-2026-09.pdf"
               hover
            >
               <Btn
                  x={176}
                  y={6}
                  w={100}
                  label="Download"
                  kind="ghost"
                  icon="download"
               />
            </ObjectRow>
            <ObjectRow
               x={0}
               y={68}
               w={288}
               name="report-2026-08.pdf"
               size="1.1 MB"
               sizeX={176}
            />
            <ObjectRow
               x={0}
               y={100}
               w={288}
               name="summary.csv"
               size="84 KB"
               sizeX={176}
            />
         </Card>
         <path
            d="M300 100C372 100 342 150 342 232"
            stroke={C.border}
            strokeWidth={1.25}
            strokeDasharray="3 4"
         />
         <Chip
            x={24}
            y={216}
            w={204}
            label="Content-Disposition: attachment"
            mono
            size={10}
         />
         <Chip
            x={24}
            y={244}
            w={188}
            label='filename="report-2026-09.pdf"'
            mono
            size={10}
         />
         <Txt x={24} y={288} size={10.5} fill={C.light}>
            The object&apos;s own filename.
         </Txt>
         <Txt x={24} y={304} size={10.5} fill={C.light}>
            Keys never reach the browser.
         </Txt>
         <rect
            x={320}
            y={188}
            width={144}
            height={88}
            rx={6}
            fill={C.white}
            stroke={C.text}
            strokeWidth={1.5}
         />
         <path
            d="M310 284H474"
            stroke={C.text}
            strokeWidth={1.5}
            strokeLinecap="round"
         />
         <Txt x={332} y={208} size={10} fill={C.light} caps>
            DOWNLOADS
         </Txt>
         <rect x={326} y={218} width={132} height={28} rx={4} fill={C.gray} />
         <Txt x={358} y={236} size={8.5} fill={C.black} mono>
            report-2026-09.pdf
         </Txt>
         <Motion
            still={
               <g transform="translate(342 232)">
                  <Landing />
               </g>
            }
         >
            <g>
               <animateMotion
                  path="M300 100C372 100 342 150 342 232"
                  keyPoints="0;1;1"
                  keyTimes="0;.6;1"
                  calcMode="linear"
                  dur="4s"
                  repeatCount="indefinite"
               />
               <Landing />
            </g>
         </Motion>
      </SVGRoot>
   </IllustrationFrame>
);

const POLICY: [string, boolean][] = [
   ['"Effect": "Allow",', false],
   ['"Action": "s3:ListBucket",', false],
   ['"Condition": {', false],
   ['  "StringLike": {', false],
   ['    "s3:prefix": [', true],
   ['      "invoices/*"', true],
   ["    ]", false],
   ["  }", false],
   ["}", false],
];

const TreeRow = ({
   y,
   name,
   depth = 0,
   role,
   selected,
   locked,
}: {
   y: number;
   name: string;
   depth?: number;
   role?: string;
   selected?: boolean;
   locked?: boolean;
}) => (
   <g transform={`translate(0 ${y})`}>
      {selected && (
         <rect width={208} height={32} fill={C.blue} opacity={0.06} />
      )}
      <Icon
         name={locked ? "lock" : "folder"}
         x={12 + depth * 20}
         y={8}
         color={locked ? C.light : depth ? C.light : C.blue}
         sw={1.4}
      />
      <Txt
         x={34 + depth * 20}
         y={20}
         fill={locked || depth ? C.light : C.black}
         mono
         size={11.5}
      >
         {name}
      </Txt>
      {role && (
         <Chip
            x={140}
            y={6}
            w={56}
            label={role}
            size={10}
            color={locked ? C.light : C.text}
         />
      )}
      <HR x={0} y={32} w={208} />
   </g>
);

export const PermissionsIllustration = () => (
   <IllustrationFrame>
      <SVGRoot>
         <FlowLine d="M232 120C244 120 244 176 256 176" />
         <circle cx={232} cy={120} r={3} fill={C.blue} />
         <circle cx={256} cy={176} r={3} fill={C.blue} />
         <Card x={24} y={40} w={208} h={272}>
            <Icon name="bucket" x={12} y={12} color={C.blue} sw={1.4} />
            <Txt x={36} y={25} weight={600} fill={C.black}>
               media-archive
            </Txt>
            <HR x={0} y={40} w={208} />
            <Txt x={12} y={58} size={10} fill={C.light} caps>
               PREFIXES
            </Txt>
            <TreeRow y={64} name="invoices/" role="Editor" selected />
            <TreeRow y={96} name="2026/" depth={1} />
            <TreeRow y={128} name="2025/" depth={1} />
            <TreeRow y={160} name="exports/" role="Viewer" />
            <TreeRow y={192} name="raw/" role="None" locked />
            <Txt x={12} y={250} size={10.5} fill={C.light}>
               Roles per prefix, not per key
            </Txt>
         </Card>
         <Card x={256} y={40} w={200} h={272}>
            <Txt x={12} y={25} weight={600} fill={C.black}>
               Bucket policy
            </Txt>
            <Chip x={152} y={10} w={36} label="IAM" mono size={10} />
            <HR x={0} y={40} w={200} />
            {POLICY.map(([line, hot], i) => (
               <g key={line} transform={`translate(0 ${64 + i * 18})`}>
                  {hot && (
                     <rect
                        x={6}
                        y={-13}
                        width={188}
                        height={18}
                        rx={4}
                        fill={C.blue}
                        opacity={0.08}
                     />
                  )}
                  <Txt
                     x={12}
                     y={0}
                     size={10}
                     fill={hot ? C.blue : C.text}
                     weight={hot ? 600 : 500}
                     mono
                  >
                     {line.replace(/^ +/, (m) => " ".repeat(m.length))}
                  </Txt>
               </g>
            ))}
            <Txt x={12} y={250} size={10.5} fill={C.light}>
               The condition everyone misses
            </Txt>
         </Card>
      </SVGRoot>
   </IllustrationFrame>
);

const SEARCH_ROWS: [string, string, boolean][] = [
   ["invoice-2026-01.pdf", "212 KB", true],
   ["invoice-2026-02.pdf", "198 KB", true],
   ["invoice-2026-03.pdf", "240 KB", true],
   ["invoice-2025-12.pdf", "231 KB", false],
   ["receipt-0918.pdf", "88 KB", false],
   ["statement.csv", "12 KB", false],
];

export const SearchIllustration = () => (
   <IllustrationFrame>
      <SVGRoot>
         <Card x={24} y={32} w={432} h={296}>
            <Field x={12} y={12} w={200} active>
               <Icon name="search" x={9} y={7} size={14} color={C.blue} />
               <Txt x={30} y={18} fill={C.black} mono>
                  invoice-2026
               </Txt>
               <Caret x={118} y={7} />
            </Field>
            <Chip x={220} y={16} w={84} label="Prefix filter" />
            <Btn x={328} y={12} w={92} label="Rows (100)" kind="ghost" />
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
            {SEARCH_ROWS.map(([n, s, hit], i) => (
               <ObjectRow
                  key={n}
                  x={0}
                  y={76 + i * 32}
                  w={432}
                  check={false}
                  size={s}
                  date="2026-09-05"
                  sizeX={232}
                  dateX={312}
                  faded={!hit}
                  menu
                  name={
                     hit ? (
                        <>
                           <tspan fill={C.blue} fontWeight={600}>
                              invoice-2026
                           </tspan>
                           {n.slice(12)}
                        </>
                     ) : (
                        n
                     )
                  }
               />
            ))}
            <Txt x={12} y={284} size={11}>
               3 of 6 objects match
            </Txt>
            <Chip
               x={284}
               y={270}
               w={136}
               label="prefix=invoice-2026"
               mono
               size={10}
            />
         </Card>
      </SVGRoot>
   </IllustrationFrame>
);

const DELETE_ROWS: [string, string, boolean][] = [
   ["tmp-export-1.csv", "2.4 MB", true],
   ["tmp-export-2.csv", "2.4 MB", true],
   ["tmp-export-3.csv", "2.3 MB", true],
   ["report.pdf", "1.2 MB", false],
   ["logo.png", "93 KB", false],
   ["hero.mp4", "80.25 MB", false],
];

export const DeleteIllustration = () => (
   <IllustrationFrame>
      <SVGRoot>
         <Card x={24} y={38} w={432} h={280}>
            <Txt x={12} y={30} weight={600} fill={C.black}>
               3 selected
            </Txt>
            <Btn
               x={88}
               y={12}
               w={80}
               label="Delete"
               kind="ghost"
               icon="trash"
               color={C.red}
            />
            <Btn x={356} y={12} w={64} label="New" icon="plus" />
            <HeaderRow
               x={0}
               y={52}
               w={432}
               check="mixed"
               cols={[
                  { label: "Name", x: 56 },
                  { label: "Size", x: 232 },
                  { label: "Modified", x: 312 },
               ]}
            />
            {DELETE_ROWS.map(([n, s, on], i) => (
               <ObjectRow
                  key={n}
                  x={0}
                  y={76 + i * 32}
                  w={432}
                  name={n}
                  size={s}
                  date="2026-09-05"
                  sizeX={232}
                  dateX={312}
                  check={on}
                  selected={on}
                  menu
               />
            ))}
            <rect
               width={432}
               height={280}
               rx={8}
               fill={C.black}
               opacity={0.05}
            />
         </Card>
         <Card x={104} y={122} w={272} h={168}>
            <Txt x={20} y={32} size={13} weight={600} fill={C.black}>
               Delete 3 objects?
            </Txt>
            <Txt x={20} y={52} size={11}>
               They will be removed from media-archive.
            </Txt>
            <rect x={20} y={66} width={232} height={44} rx={6} fill={C.gray} />
            <Icon
               name="info"
               x={30}
               y={80}
               size={14}
               color={C.light}
               sw={1.3}
            />
            <Txt x={50} y={84} size={10}>
               Versioning is on: S3 adds a delete marker,
            </Txt>
            <Txt x={50} y={98} size={10}>
               older versions stay recoverable.
            </Txt>
            <Btn x={60} y={124} w={64} label="Cancel" kind="ghost" />
            <Btn
               x={132}
               y={124}
               w={120}
               label="Delete 3 objects"
               kind="danger"
            />
         </Card>
         <Motion still={<Cursor x={344} y={264} />}>
            <g>
               <Glide values="84 64;0 0;0 0" keyTimes="0;.45;1" dur="4.5s" />
               <Cursor x={344} y={264} />
            </g>
         </Motion>
      </SVGRoot>
   </IllustrationFrame>
);
