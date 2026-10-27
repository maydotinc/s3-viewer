type Tone = "error" | "notice";

type Message = { tone: Tone; text: string };

export type { Message, Tone };
