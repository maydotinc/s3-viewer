import { BRAND_COLORS } from "@/lib/palette";

type ColorToken = {
   id: string;
   name: string;
   hex: string;
   role: string;
};

export const COLORS: ColorToken[] = [
   {
      id: "viewer-blue",
      name: "Viewer Blue",
      hex: BRAND_COLORS.blue.hex,
      role: "Primary brand color. Used for CTAs and accents.",
   },
   {
      id: "viewer-dark-blue",
      name: "Viewer Dark Blue",
      hex: BRAND_COLORS.darkBlue.hex,
      role: "Hero backgrounds and emphasis surfaces.",
   },
   {
      id: "viewer-black",
      name: "Viewer Black",
      hex: BRAND_COLORS.black.hex,
      role: "Headings and high-emphasis text.",
   },
   {
      id: "viewer-text",
      name: "Viewer Text",
      hex: BRAND_COLORS.text.hex,
      role: "Body copy and secondary text.",
   },
   {
      id: "viewer-light",
      name: "Viewer Light",
      hex: BRAND_COLORS.light.hex,
      role: "Captions and meta text.",
   },
   {
      id: "viewer-border",
      name: "Viewer Border",
      hex: BRAND_COLORS.border.hex,
      role: "Hairlines and dividers.",
   },
   {
      id: "viewer-gray",
      name: "Viewer Gray",
      hex: BRAND_COLORS.gray.hex,
      role: "Muted surfaces and section backgrounds.",
   },
   {
      id: "viewer-white",
      name: "Viewer White",
      hex: BRAND_COLORS.white.hex,
      role: "Default page background.",
   },
];

type LogoAsset = {
   id: string;
   name: string;
   description: string;
   filename: string;
   path: string;
   alt: string;
   previewBg: string;
   previewSize: string;
};

// the web app serves /icons/ from its own public dir and only proxies /landing/ to this app, so landing-only files live there.
export const LOGOS: LogoAsset[] = [
   {
      id: "full-logo",
      name: "Wordmark",
      description: "Primary lockup. Use on light backgrounds.",
      filename: "viewer.svg",
      path: "/icons/viewer.svg",
      alt: "S3 Viewer wordmark",
      previewBg: "bg-viewerwhite",
      previewSize: "h-9 w-auto",
   },
   {
      id: "white-logo",
      name: "Wordmark on Brand",
      description: "Reverse lockup. Use on Viewer Blue or photography.",
      filename: "whiteviewer.svg",
      path: "/landing/icons/whiteviewer.svg",
      alt: "S3 Viewer wordmark on brand",
      previewBg: "bg-viewerblue",
      previewSize: "h-9 w-auto",
   },
   {
      id: "app-icon",
      name: "App Icon",
      description: "Filled mark. App icons, favicons, square avatars.",
      filename: "viewerblue.svg",
      path: "/landing/icons/viewerblue.svg",
      alt: "S3 Viewer app icon",
      previewBg: "bg-viewergray",
      previewSize: "h-14 w-14",
   },
   {
      id: "mark-only",
      name: "Mark",
      description: "Standalone mark. Use when wordmark is unnecessary.",
      filename: "logo.svg",
      path: "/landing/logo.svg",
      alt: "S3 Viewer mark",
      previewBg: "bg-viewergray",
      previewSize: "h-14 w-14",
   },
];

export const SECTIONS = [
   { id: "logos", title: "Logos" },
   { id: "colors", title: "Colors" },
   { id: "typography", title: "Typography" },
   { id: "voice", title: "Voice" },
] as const;

type TypeScaleRow = {
   label: string;
   sample: string;
   className: string;
   meta: string;
};

export const TYPE_SCALE: TypeScaleRow[] = [
   {
      label: "Display",
      sample: "Object storage, simplified.",
      className:
         "text-[40px] sm:text-[52px] tracking-[-0.02em] leading-[1.04] font-semibold text-viewerblack",
      meta: "Inter Semibold · 52 / 54 · -2% letter",
   },
   {
      label: "Heading",
      sample: "Browse every bucket.",
      className:
         "text-[26px] sm:text-[30px] tracking-tight leading-[1.2] font-semibold text-viewerblack",
      meta: "Inter Semibold · 30 / 36",
   },
   {
      label: "Body",
      sample:
         "S3 Viewer is a fast, open-source viewer for any S3-compatible API.",
      className: "text-base leading-relaxed text-viewertext",
      meta: "Inter Regular · 16 / 28",
   },
   {
      label: "Caption",
      sample: "Last updated September 2, 2026",
      className: "text-xs tracking-[0.02em] text-viewerlighttext",
      meta: "Inter Medium · 12 / 18",
   },
];

type VoiceExample = {
   ok: boolean;
   label: string;
   line: string;
};

export const VOICE_EXAMPLES: VoiceExample[] = [
   {
      ok: true,
      label: "Use",
      line: "Connect any S3-compatible bucket with one set of credentials.",
   },
   {
      ok: false,
      label: "Avoid",
      line: "Revolutionary AI-powered cloud storage hub.",
   },
   {
      ok: true,
      label: "Use",
      line: "Your credentials are encrypted at rest.",
   },
   {
      ok: false,
      label: "Avoid",
      line: "Bank-grade military-level enterprise security.",
   },
];
