import { Suspense } from "react";
import type { Metadata } from "next";

import { StudyScreen } from "@/components/study/study-screen";
import { StudyScreenFallback } from "@/components/study/study-layout";

export const metadata: Metadata = {
  title: "Nauka fiszek",
  description:
    "Ucz się zapisanych słów w trybie fiszek. Trudne słowa wracają do powtórki w tej samej sesji.",
};

export default function StudyPage() {
  return (
    <Suspense fallback={<StudyScreenFallback />}>
      <StudyScreen />
    </Suspense>
  );
}
