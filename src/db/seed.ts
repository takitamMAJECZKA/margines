import { db } from "./index";

// Kept from the first release so existing installations are not re-seeded.
const SEED_KEY = "defaults-seeded-at";
export const ONBOARDING_COMPLETED_KEY = "onboarding-completed-at";

/**
 * First run no longer creates Spanish and English automatically. The user
 * chooses their dictionaries on the onboarding screen instead. Existing
 * installs already have dictionaries, so they are marked as onboarded and go
 * straight to their vocabulary.
 */
export async function seedDatabase(): Promise<void> {
  await db.transaction("rw", db.dictionaries, db.meta, async () => {
    const seeded = await db.meta.get(SEED_KEY);
    const onboarding = await db.meta.get(ONBOARDING_COMPLETED_KEY);
    const existingCount = await db.dictionaries.count();

    if (!seeded) {
      await db.meta.put({ key: SEED_KEY, value: Date.now() });
    }

    if (existingCount > 0 && !onboarding) {
      await db.meta.put({
        key: ONBOARDING_COMPLETED_KEY,
        value: Date.now(),
      });
    }
  });
}

export async function isOnboardingComplete(): Promise<boolean> {
  const entry = await db.meta.get(ONBOARDING_COMPLETED_KEY);
  return Boolean(entry);
}

export async function completeOnboarding(): Promise<void> {
  await db.meta.put({
    key: ONBOARDING_COMPLETED_KEY,
    value: Date.now(),
  });
}

export async function markDictionaryUsed(id: string): Promise<void> {
  await db.meta.put({ key: `dictionary-used:${id}`, value: Date.now() });
}
