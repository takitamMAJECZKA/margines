"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

import type { LanguageCode } from "@/lib/languages";

/**
 * The browser's built-in speech synthesis is free, works offline once the
 * system voices are installed, and speaks with the accent of the locale we
 * tag the utterance with. The first locale is preferred, the rest are
 * fallbacks for devices that ship only one regional voice.
 */
const SPEECH_LOCALES: Record<LanguageCode, string[]> = {
  en: ["en-US", "en-GB"],
  es: ["es-ES", "es-MX"],
  de: ["de-DE", "de-AT"],
  fr: ["fr-FR", "fr-CA"],
  pl: ["pl-PL"],
};

const SPEECH_RATE = 0.95;

/**
 * Many Windows installs only ship voices for the system language (for example
 * Polish) and English. Speaking Spanish with that default voice gives the
 * words a Polish accent, so when no device voice matches the card language we
 * stream the phrase through our own TTS proxy. That endpoint keeps a native
 * accent available and hides the upstream provider from the browser.
 */
const ONLINE_TTS_PATH = "/api/tts";
const ONLINE_TTS_CHUNK_LENGTH = 180;

function normalizeLang(value: string): string {
  return value.replace(/_/g, "-").toLowerCase();
}

/** Removes typography that synthesizers tend to read out literally. */
function cleanText(text: string): string {
  return text
    .replace(/_{2,}/g, " ")
    .replace(/[„”«»]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function voiceScore(
  voice: SpeechSynthesisVoice,
  language: LanguageCode,
): number {
  const locales = SPEECH_LOCALES[language];
  const lang = normalizeLang(voice.lang);
  const preferredIndex = locales.indexOf(lang);

  let score: number;
  if (preferredIndex === 0) score = 12;
  else if (preferredIndex > 0) score = 10;
  else if (lang === language) score = 8;
  else if (lang.startsWith(`${language}-`)) score = 6;
  else return -1;

  // Many platforms ship both a robotic legacy voice and a better modern one.
  if (/natural|neural|premium|enhanced/i.test(voice.name)) score += 4;
  if (/google/i.test(voice.name)) score += 3;
  if (voice.localService) score += 2;
  if (voice.default) score += 1;

  return score;
}

export function pickVoice(
  voices: SpeechSynthesisVoice[],
  language: LanguageCode,
): SpeechSynthesisVoice | null {
  let best: SpeechSynthesisVoice | null = null;
  let bestScore = 0;

  for (const voice of voices) {
    const score = voiceScore(voice, language);
    if (score > bestScore) {
      best = voice;
      bestScore = score;
    }
  }

  return best;
}

function onlineSpeechUrl(text: string, language: LanguageCode): string {
  const params = new URLSearchParams({ text, language });
  return `${ONLINE_TTS_PATH}?${params.toString()}`;
}

/** Splits the phrase into pieces the online TTS endpoint accepts. */
function chunkText(text: string, maxLength: number): string[] {
  const words = text.split(" ");
  const chunks: string[] = [];
  let current = "";

  for (const word of words) {
    if (!current) {
      current = word;
    } else if (current.length + word.length + 1 <= maxLength) {
      current = `${current} ${word}`;
    } else {
      chunks.push(current);
      current = word;
    }

    // A single very long word still has to be cut somewhere.
    while (current.length > maxLength) {
      chunks.push(current.slice(0, maxLength));
      current = current.slice(maxLength);
    }
  }

  if (current) chunks.push(current);
  return chunks;
}

export interface SpeechController {
  /** True once we know the browser exposes the Web Speech API. */
  supported: boolean;
  /** Key of the phrase that is currently being read, or null. */
  speakingKey: string | null;
  speak: (text: string, language: LanguageCode, key?: string) => void;
  stop: () => void;
}

function subscribeToSupport() {
  return () => {};
}

function getSupportSnapshot() {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

function getSupportServerSnapshot() {
  return false;
}

/**
 * Thin wrapper around `window.speechSynthesis` with a network voice fallback.
 * No API keys and no extra dependency: the device voices speak each language
 * with the accent they were installed with, and only when the device has no
 * voice for a language do we stream it from the server's TTS proxy.
 */
export function useSpeech(): SpeechController {
  // Support is read from the browser instead of being stored in state, so the
  // server render and the hydrated client agree on what to show.
  const supported = useSyncExternalStore(
    subscribeToSupport,
    getSupportSnapshot,
    getSupportServerSnapshot,
  );
  const [speakingKey, setSpeakingKey] = useState<string | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  // Every new request bumps this token so late callbacks from a previous
  // utterance or audio stream cannot start playing again.
  const requestRef = useRef(0);

  const stopAudio = useCallback(() => {
    const audio = audioRef.current;
    audioRef.current = null;
    if (!audio) return;

    audio.onended = null;
    audio.onerror = null;
    audio.pause();
    audio.removeAttribute("src");
    audio.load();
  }, []);

  const stop = useCallback(() => {
    requestRef.current += 1;
    utteranceRef.current = null;
    stopAudio();

    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }

    setSpeakingKey(null);
  }, [stopAudio]);

  useEffect(() => {
    if (!supported) return;

    return () => {
      requestRef.current += 1;
      utteranceRef.current = null;

      const audio = audioRef.current;
      audioRef.current = null;
      if (audio) {
        audio.onended = null;
        audio.onerror = null;
        audio.pause();
        audio.removeAttribute("src");
      }

      window.speechSynthesis.cancel();
    };
  }, [supported]);

  const speak = useCallback(
    (text: string, language: LanguageCode, key?: string) => {
      if (typeof window === "undefined") return;

      const phrase = cleanText(text);
      if (!phrase) return;

      const synth = "speechSynthesis" in window ? window.speechSynthesis : null;
      const token = requestRef.current + 1;
      requestRef.current = token;
      utteranceRef.current = null;
      stopAudio();
      synth?.cancel();

      const nextKey = key ?? phrase;
      setSpeakingKey(nextKey);

      const finish = () => {
        if (requestRef.current !== token) return;
        utteranceRef.current = null;
        stopAudio();
        setSpeakingKey(null);
      };

      const speakWithSystem = (voice: SpeechSynthesisVoice | null) => {
        if (requestRef.current !== token) return;
        if (!synth) {
          finish();
          return;
        }

        const utterance = new SpeechSynthesisUtterance(phrase);
        if (voice) {
          utterance.voice = voice;
          utterance.lang = voice.lang;
        } else {
          utterance.lang = SPEECH_LOCALES[language][0];
        }
        utterance.rate = SPEECH_RATE;
        utterance.pitch = 1;

        utteranceRef.current = utterance;
        utterance.onend = finish;
        utterance.onerror = finish;

        synth.speak(utterance);
      };

      const speakOnline = () => {
        if (requestRef.current !== token) return;

        const chunks = chunkText(phrase, ONLINE_TTS_CHUNK_LENGTH);

        const play = (index: number) => {
          if (requestRef.current !== token) return;
          if (index >= chunks.length) {
            finish();
            return;
          }

          const audio = new Audio(onlineSpeechUrl(chunks[index], language));
          audioRef.current = audio;

          audio.onended = () => {
            if (requestRef.current !== token) return;
            play(index + 1);
          };
          audio.onerror = () => {
            if (requestRef.current !== token) return;
            console.warn("Online pronunciation is unavailable");
            finish();
          };

          void audio.play().catch(() => {
            if (requestRef.current !== token) return;
            console.warn("Online pronunciation could not be played");
            finish();
          });
        };

        play(0);
      };

      const startWithVoices = (voices: SpeechSynthesisVoice[]) => {
        if (requestRef.current !== token) return;

        const voice = pickVoice(voices, language);
        if (voice) {
          speakWithSystem(voice);
          return;
        }

        // No device voice speaks this language, so the default voice would
        // read it with the wrong accent. Prefer the network voice when we are
        // online; otherwise at least let the system try.
        if (typeof navigator === "undefined" || navigator.onLine) {
          speakOnline();
        } else {
          speakWithSystem(null);
        }
      };

      if (!synth) {
        startWithVoices([]);
        return;
      }

      const activeSynth = synth;
      const voices = activeSynth.getVoices();
      if (voices.length > 0) {
        startWithVoices(voices);
        return;
      }

      // Chrome and Edge fill the voice list asynchronously. Speaking before
      // that finishes makes them use the system default voice (Polish on a
      // Polish Windows install), so give the list a moment to arrive.
      let settled = false;
      let timer = 0;

      function settle() {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        activeSynth.removeEventListener("voiceschanged", onVoices);
        startWithVoices(activeSynth.getVoices());
      }

      function onVoices() {
        settle();
      }

      timer = window.setTimeout(settle, 400);
      activeSynth.addEventListener("voiceschanged", onVoices);
    },
    [stopAudio],
  );

  return { supported, speakingKey, speak, stop };
}
