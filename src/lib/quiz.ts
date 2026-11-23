import type { Word } from "@/db/types";
import { clozeForWord, hasTatoebaExample } from "@/lib/cloze";
import { normalizeWord } from "@/lib/utils";

export interface QuizQuestion {
  word: Word;
  sentence: string;
  translation: string;
  answer: string;
  options: string[];
}

function shuffle<T>(items: T[]): T[] {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[randomIndex]] = [
      shuffled[randomIndex],
      shuffled[index],
    ];
  }
  return shuffled;
}

/** Words from the selected scope that can produce a Tatoeba cloze question. */
export function quizCandidateWords(words: Word[], language: string): Word[] {
  return words.filter(
    (word) => hasTatoebaExample(word) && clozeForWord(word, language) !== null,
  );
}

function uniqueWords(words: Word[]): Word[] {
  const seen = new Set<string>();
  return words.filter((word) => {
    const key = normalizeWord(word.originalWord);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Builds ABCD questions for the scoped words. Distractors come from the whole
 * dictionary so even a small set can have four options.
 */
export function buildQuizQuestions(
  scopeWords: Word[],
  dictionaryWords: Word[],
  language: string,
): QuizQuestion[] {
  const distractorsPool = uniqueWords(dictionaryWords);

  if (distractorsPool.length < 4) return [];

  const candidates = quizCandidateWords(scopeWords, language);
  if (candidates.length === 0) return [];

  return shuffle(candidates).flatMap((word) => {
    const cloze = clozeForWord(word, language);
    if (!cloze) return [];

    const answerKey = normalizeWord(cloze.answer);
    const usedLabels = new Set([answerKey]);
    const options: string[] = [cloze.answer];

    // Distractors are other words from the dictionary. When a distractor has
    // its own saved sentence, its inflected form is a more natural option than
    // the dictionary headword.
    for (const candidate of shuffle(distractorsPool)) {
      if (options.length === 4) break;
      if (candidate.id === word.id) continue;
      if (normalizeWord(candidate.originalWord) === answerKey) continue;

      const candidateCloze = clozeForWord(candidate, language);
      let label = candidateCloze?.answer ?? candidate.originalWord;
      let labelKey = normalizeWord(label);
      if (usedLabels.has(labelKey)) {
        label = candidate.originalWord;
        labelKey = normalizeWord(label);
      }
      if (usedLabels.has(labelKey)) continue;

      usedLabels.add(labelKey);
      options.push(label);
    }

    if (options.length < 4) return [];

    return [
      {
        word,
        sentence: cloze.sentence,
        translation: word.exampleTranslation,
        answer: cloze.answer,
        options: shuffle(options),
      },
    ];
  });
}
