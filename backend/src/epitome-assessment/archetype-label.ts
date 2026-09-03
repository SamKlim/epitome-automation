export const ARCHETYPES = ['Sovereign', 'Empress', 'Consort', 'Seductress'] as const;
export type Archetype = (typeof ARCHETYPES)[number];

export interface ArchetypeScores {
  Sovereign: number;
  Empress: number;
  Consort: number;
  Seductress: number;
}

/**
 * Rankings run 1 ("fully describes me") to 4 ("does not describe me at all"),
 * so the archetype with the LOWEST summed score is the one the user leads with.
 * Any archetype within this many points of the lowest is shown alongside it.
 */
const LEADING_ARCHETYPE_SPREAD = 2;

export function getArchetypeLabel(scores: ArchetypeScores | null | undefined): string {
  if (!scores) {
    throw new Error('Cannot determine archetype label: archetype_scores is missing.');
  }

  const ranked = ARCHETYPES.map((name) => {
    const score = scores[name];
    if (typeof score !== 'number' || !Number.isFinite(score)) {
      throw new Error(`Cannot determine archetype label: ${name} score is missing or invalid.`);
    }
    return { name, score };
  }).sort((a, b) => a.score - b.score);

  const lowestScore = ranked[0].score;
  const leading = ranked.filter((entry) => entry.score <= lowestScore + LEADING_ARCHETYPE_SPREAD);

  return leading.map((entry) => entry.name).join(' and ');
}
