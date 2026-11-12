import type { Word } from "@/db/types";

export interface StudyState {
  mode: "standard" | "daily";
  cards: Word[];
  queue: Word[];
  current: Word | null;
  revealed: boolean;
  knownIds: string[];
  firstTryKnownIds: string[];
  attempts: number;
  misses: Record<string, number>;
  finished: boolean;
}

export type StudyAction =
  | { type: "start"; words: Word[]; mode: "standard" | "daily" }
  | { type: "reveal" }
  | { type: "answer"; known: boolean }
  | { type: "reset" };

export function shuffleWords(words: Word[]): Word[] {
  const shuffled = [...words];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]];
  }

  return shuffled;
}

export function createStudyState(
  words: Word[],
  mode: "standard" | "daily",
): StudyState {
  const shuffled = shuffleWords(words);

  return {
    mode,
    cards: shuffled,
    queue: shuffled,
    current: shuffled[0] ?? null,
    revealed: false,
    knownIds: [],
    firstTryKnownIds: [],
    attempts: 0,
    misses: {},
    finished: shuffled.length === 0,
  };
}

export function studyReducer(
  state: StudyState | null,
  action: StudyAction,
): StudyState | null {
  if (action.type === "reset") return null;
  if (action.type === "start") return createStudyState(action.words, action.mode);

  if (!state || state.finished || !state.current) return state;

  if (action.type === "reveal") {
    return { ...state, revealed: true };
  }

  const word = state.current;
  const attempts = state.attempts + 1;
  const misses = { ...state.misses };

  if (action.known) {
    const queue = state.queue.slice(1);
    const wasMissed = (misses[word.id] ?? 0) > 0;

    return {
      ...state,
      queue,
      current: queue[0] ?? null,
      revealed: false,
      attempts,
      knownIds: [...state.knownIds, word.id],
      firstTryKnownIds: wasMissed
        ? state.firstTryKnownIds
        : [...state.firstTryKnownIds, word.id],
      finished: queue.length === 0,
    };
  }

  misses[word.id] = (misses[word.id] ?? 0) + 1;
  if (state.mode === "daily") {
    const queue = state.queue.slice(1);
    return {
      ...state,
      queue,
      current: queue[0] ?? null,
      revealed: false,
      attempts,
      misses,
      finished: queue.length === 0,
    };
  }

  const queue = [...state.queue.slice(1), word];

  return {
    ...state,
    queue,
    current: queue[0] ?? word,
    revealed: false,
    attempts,
    misses,
    finished: false,
  };
}
