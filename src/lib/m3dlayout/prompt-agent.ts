import { FURNITURE_ALIASES, promptNameForClass, type M3DClassLabel } from "./vocabulary";

/**
 * Rewrites a casual room request into the description style M3DLayout was trained on.
 *
 * The autoregressive checkpoint conditions on bert-base-cased. Its training text
 * names the room, lists furniture with the dataset's words, then adds a short
 * placement sentence and an object-scope constraint.
 */

export type PromptTranslation = {
  userQuery: string;
  prompt: string;
  roomType: string;
  classes: string[];
  style: "passthrough" | "rewritten";
  ready: boolean;
  note: string;
};

type RoomType = "living room" | "bedroom" | "dining room" | "kitchen" | "bathroom" | "office";

type Mention = {
  className: M3DClassLabel;
  start: number;
  end: number;
  count: number;
};

const ROOM_PHRASES: ReadonlyArray<{ phrase: string; room: RoomType }> = [
  { phrase: "dining room", room: "dining room" },
  { phrase: "living room", room: "living room" },
  { phrase: "livingroom", room: "living room" },
  { phrase: "waiting room", room: "living room" },
  { phrase: "waiting area", room: "living room" },
  { phrase: "reception", room: "living room" },
  { phrase: "bedroom", room: "bedroom" },
  { phrase: "bathroom", room: "bathroom" },
  { phrase: "restroom", room: "bathroom" },
  { phrase: "washroom", room: "bathroom" },
  { phrase: "kitchen", room: "kitchen" },
  { phrase: "consultation", room: "office" },
  { phrase: "office", room: "office" },
  { phrase: "study", room: "office" },
  { phrase: "lounge", room: "living room" },
  { phrase: "clinic", room: "living room" },
];

const ROOM_DEFAULTS: Record<RoomType, M3DClassLabel[]> = {
  "living room": ["sofa", "coffee_table", "tv_stand"],
  bedroom: ["bed", "nightstand", "wardrobe"],
  "dining room": ["dining_table", "dining_chair"],
  kitchen: ["kitchen_cabinet", "sink", "dining_table"],
  bathroom: ["toilet", "sink", "bathtub"],
  office: ["desk", "chair", "bookshelf"],
};

const RELATIONS: ReadonlyArray<{ pattern: RegExp; verb: string; wallFallback: boolean }> = [
  { pattern: /\b(?:facing|faces|face)\b/g, verb: "faces", wallFallback: false },
  { pattern: /\bin front of\b/g, verb: "is in front of", wallFallback: false },
  { pattern: /\bbehind\b/g, verb: "is behind", wallFallback: false },
  { pattern: /\b(?:next to|beside|alongside)\b/g, verb: "is next to", wallFallback: false },
  { pattern: /\bopposite\b/g, verb: "is opposite", wallFallback: false },
  { pattern: /\bbetween\b/g, verb: "is between", wallFallback: false },
  { pattern: /\bagainst\b/g, verb: "is positioned against", wallFallback: true },
];

const ALIASES = [...FURNITURE_ALIASES].sort((a, b) => b.phrase.length - a.phrase.length);

function isWordChar(char: string | undefined): boolean {
  return !!char && /[a-z0-9]/i.test(char);
}

function matchEnd(text: string, phrase: string, at: number): number | null {
  if (!text.startsWith(phrase, at)) return null;
  let end = at + phrase.length;
  if (text.startsWith("es", end) && /(sh|ch|x)$/.test(phrase)) end += 2;
  else if (text[end] === "s" && !phrase.endsWith("s")) end += 1;
  if (isWordChar(text[at - 1]) || isWordChar(text[end])) return null;
  return end;
}

function countBefore(text: string, start: number): number {
  const prefix = text.slice(Math.max(0, start - 24), start);
  if (/(?:a pair of|two|2)\s+$/.test(prefix)) return 2;
  if (/(?:three|3)\s+$/.test(prefix)) return 3;
  if (/(?:four|4)\s+$/.test(prefix)) return 4;
  if (/(?:five|5)\s+$/.test(prefix)) return 5;
  return 1;
}

function extractMentions(text: string): Mention[] {
  const consumed = new Array<boolean>(text.length).fill(false);
  const found: Mention[] = [];
  for (const alias of ALIASES) {
    let from = 0;
    while (from < text.length) {
      const at = text.indexOf(alias.phrase, from);
      if (at < 0) break;
      const end = matchEnd(text, alias.phrase, at);
      const overlaps = end !== null && consumed.slice(at, end).some(Boolean);
      if (end !== null && !overlaps) {
        for (let i = at; i < end; i += 1) consumed[i] = true;
        found.push({
          className: alias.className,
          start: at,
          end,
          count: countBefore(text, at),
        });
      }
      from = at + 1;
    }
  }
  found.sort((a, b) => a.start - b.start);
  return found;
}

function maskSpans(text: string, mentions: Mention[]): string {
  const chars = text.split("");
  for (const mention of mentions) {
    for (let i = mention.start; i < mention.end; i += 1) chars[i] = " ";
  }
  return chars.join("");
}

function explicitRoom(masked: string): RoomType | null {
  for (const rule of [...ROOM_PHRASES].sort((a, b) => b.phrase.length - a.phrase.length)) {
    let from = 0;
    while (from < masked.length) {
      const at = masked.indexOf(rule.phrase, from);
      if (at < 0) break;
      const end = at + rule.phrase.length;
      if (!isWordChar(masked[at - 1]) && !isWordChar(masked[end])) return rule.room;
      from = at + 1;
    }
  }
  return null;
}

function inferRoom(classes: string[]): RoomType | null {
  const scores: Record<RoomType, number> = {
    "living room": 0,
    bedroom: 0,
    "dining room": 0,
    kitchen: 0,
    bathroom: 0,
    office: 0,
  };
  for (const name of classes) {
    if (["sofa", "l_shaped_sofa", "loveseat_sofa", "multi_seat_sofa", "coffee_table", "tv", "tv_stand", "armchair"].includes(name)) {
      scores["living room"] += 1;
    }
    if (["bed", "kids_bed", "nightstand", "wardrobe", "dressing_table"].includes(name)) scores.bedroom += 1;
    if (["dining_table", "dining_chair"].includes(name)) scores["dining room"] += 1;
    if (["kitchen_cabinet", "oven", "microwave", "dishwasher", "counter"].includes(name)) scores.kitchen += 1;
    if (["toilet", "bathtub", "shower", "standing_sink"].includes(name)) scores.bathroom += 1;
    if (name === "desk" || name === "bookshelf") scores.office += 1;
  }
  let best: RoomType | null = null;
  let bestScore = 0;
  for (const room of Object.keys(scores) as RoomType[]) {
    if (scores[room] > bestScore) {
      best = room;
      bestScore = scores[room];
    }
  }
  return best;
}

function article(name: string): string {
  return /^[aeiou]/.test(name) ? "an" : "a";
}

function plural(name: string): string {
  if (name === "bookshelf") return "bookshelves";
  if (name.endsWith("s")) return name;
  if (/(sh|ch|x)$/.test(name)) return `${name}es`;
  return `${name}s`;
}

function countWord(count: number): string {
  return ["", "one", "two", "three", "four", "five"][count] ?? String(count);
}

function nounPhrase(className: string, count: number): string {
  const name = promptNameForClass(className);
  if (count <= 1) return `${article(name)} ${name}`;
  return `${countWord(Math.min(count, 5))} ${plural(name)}`;
}

function joinPhrases(phrases: string[]): string {
  if (phrases.length <= 1) return phrases[0] ?? "furniture";
  if (phrases.length === 2) return `${phrases[0]} and ${phrases[1]}`;
  return `${phrases.slice(0, -1).join(", ")}, and ${phrases[phrases.length - 1]}`;
}

function capitalize(sentence: string): string {
  return sentence.charAt(0).toUpperCase() + sentence.slice(1);
}

function spatialSentences(text: string, mentions: Mention[]): string[] {
  const sentences: string[] = [];
  const seen = new Set<string>();
  for (const relation of RELATIONS) {
    relation.pattern.lastIndex = 0;
    for (const match of text.matchAll(relation.pattern)) {
      if (sentences.length >= 2 || match.index === undefined) break;
      const before = [...mentions].reverse().find((item) => item.end <= match.index!);
      const after = mentions.find((item) => item.start >= match.index! + match[0].length);
      let sentence: string | null = null;
      if (before && after) {
        sentence = `${capitalize(nounPhrase(before.className, 1))} ${relation.verb} ${nounPhrase(after.className, 1)}.`;
      } else if (before && relation.wallFallback) {
        sentence = `${capitalize(nounPhrase(before.className, 1))} is positioned against one wall.`;
      }
      if (sentence && !seen.has(sentence)) {
        seen.add(sentence);
        sentences.push(sentence);
      }
    }
  }
  return sentences;
}

function constraintSentence(text: string): string {
  if (/\b(detailed|decorated|lots of decor|cluttered)\b/.test(text)) {
    return "Only include the objects described above. The scene includes many detailed elements.";
  }
  if (/\b(minimal|simple|uncluttered|sparse)\b/.test(text)) {
    return "Only include the objects described above. The layout is simple and minimal. Do not include small decorative items.";
  }
  return "Only include the objects described above. Do not include small decorative items.";
}

function isTrainingStyle(text: string): boolean {
  const trimmed = text.trim();
  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length < 12) return false;
  return /^(the room is|this is a|this (living room|bedroom|dining room|kitchen|bathroom)|in the (living room|bedroom|dining room|kitchen)|the (living room|bedroom|dining room|kitchen|bathroom)\b)/i.test(trimmed);
}

function mergeMentions(mentions: Mention[]): Array<{ className: M3DClassLabel; count: number }> {
  const merged: Array<{ className: M3DClassLabel; count: number }> = [];
  for (const mention of mentions) {
    const existing = merged.find((item) => item.className === mention.className);
    if (existing) existing.count += mention.count;
    else merged.push({ className: mention.className, count: mention.count });
  }
  return merged.map((item) => ({ ...item, count: Math.min(item.count, 5) }));
}

export function translateUserQuery(userQuery: string): PromptTranslation {
  const trimmed = userQuery.trim().replace(/\s+/g, " ");
  const empty: PromptTranslation = {
    userQuery: trimmed,
    prompt: "",
    roomType: "",
    classes: [],
    style: "rewritten",
    ready: false,
    note: "Name a room and its furniture. Example: a living room with a sofa and a television.",
  };
  if (!trimmed) return empty;

  const lower = trimmed.toLowerCase();
  const mentions = extractMentions(lower);
  const merged = mergeMentions(mentions);
  const room = explicitRoom(maskSpans(lower, mentions)) ?? inferRoom(merged.map((item) => item.className));

  if (isTrainingStyle(trimmed)) {
    return {
      userQuery: trimmed,
      prompt: trimmed,
      roomType: room ?? "",
      classes: merged.map((item) => item.className),
      style: "passthrough",
      ready: true,
      note: "This already matches the model's description style, so it is sent unchanged.",
    };
  }

  const usedDefaults = merged.length === 0 && room !== null;
  const objects = merged.length > 0 ? merged : room ? ROOM_DEFAULTS[room].map((className) => ({ className, count: 1 })) : [];
  if (!room || objects.length === 0) return empty;

  const roomSentence = room === "office" ? "The room is an office." : `The room is a ${room}.`;
  const thereIs = `There is ${joinPhrases(objects.map((item) => nounPhrase(item.className, item.count)))}.`;
  const spatial = spatialSentences(lower, mentions);
  const placement = spatial.length > 0 ? spatial.join(" ") : "The furniture is placed for optimal use.";
  const prompt = `${roomSentence} ${thereIs} ${placement} ${constraintSentence(lower)}`;
  const names = objects.map((item) => promptNameForClass(item.className)).join(", ");

  return {
    userQuery: trimmed,
    prompt,
    roomType: room,
    classes: objects.map((item) => item.className),
    style: "rewritten",
    ready: true,
    note: usedDefaults
      ? `No furniture names were recognized, so a typical ${room} set is used: ${names}.`
      : `Rewrote this into a ${room} description the model was trained on: ${names}.`,
  };
}
