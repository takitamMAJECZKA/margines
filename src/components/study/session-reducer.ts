import type { Word } from "@/db/types";

export interface StudySnapshot {
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

export interface StudyAnswer {
  wordId: string;
  known: boolean;
}

export interface StudyHistoryEntry {
  /** Session state from before the answer, restored by an undo. */
  state: StudySnapshot;
  answer: StudyAnswer;
}

export interface StudyState extends StudySnapshot {
  /** Answered cards, newest last. Undo walks this stack backwards. */
  history: StudyHistoryEntry[];
}

export type StudyAction =
  | { type: "start"; words: Word[]; mode: "standard" | "daily" }
  | { type: "reveal" }
  | { type: "answer"; known: boolean; knowledgeScore?: number }
  | { type: "undo" }
  | { type: "reset" };

export function shuffleWords(words: Word[]): Word[] {
  const shuffled = [...words];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]];
  }

  return shuffled;
}

function snapshot(state: StudySnapshot): StudySnapshot {
  const {
    mode,
    cards,
    queue,
    current,
    revealed,
    knownIds,
    firstTryKnownIds,
    attempts,
    misses,
    finished,
  } = state;

  return {
    mode,
    cards,
    queue,
    current,
    revealed,
    knownIds,
    firstTryKnownIds,
    attempts,
    misses,
    finished,
  };
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
    history: [],
  };
}

export function studyReducer(
  state: StudyState | null,
  action: StudyAction,
): StudyState | null {
  if (action.type === "reset") return null;
  if (action.type === "start") return createStudyState(action.words, action.mode);

  if (!state) return state;

  if (action.type === "undo") {
    const last = state.history.at(-1);
    if (!last) return state;

    return { ...last.state, history: state.history.slice(0, -1) };
  }

  if (state.finished || !state.current) return state;

  if (action.type === "reveal") {
    return { ...state, revealed: true };
  }

  const word = state.current;
  const attempts = state.attempts + 1;
  const misses = { ...state.misses };
  const cards =
    action.knowledgeScore === undefined
      ? state.cards
      : state.cards.map((card) =>
          card.id === word.id
            ? { ...card, knowledgeScore: action.knowledgeScore! }
            : card,
        );
  const history = [
    ...state.history,
    { state: snapshot(state), answer: { wordId: word.id, known: action.known } },
  ];

  if (action.known) {
    const queue = state.queue.slice(1);
    const wasMissed = (misses[word.id] ?? 0) > 0;

    return {
      ...state,
      cards,
      queue,
      current: queue[0] ?? null,
      revealed: false,
      attempts,
      knownIds: [...state.knownIds, word.id],
      firstTryKnownIds: wasMissed
        ? state.firstTryKnownIds
        : [...state.firstTryKnownIds, word.id],
      finished: queue.length === 0,
      history,
    };
  }

  misses[word.id] = (misses[word.id] ?? 0) + 1;
  if (state.mode === "daily") {
    const queue = state.queue.slice(1);
    return {
      ...state,
      cards,
      queue,
      current: queue[0] ?? null,
      revealed: false,
      attempts,
      misses,
      finished: queue.length === 0,
      history,
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
    history,
  };
}
