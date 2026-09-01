import { Injectable } from '@nestjs/common';
import { ArchetypeScores } from './transform.service';

interface ArchetypeEntry {
  name: string;
  score: number;
}

@Injectable()
export class ArchetypeLabelService {
  getLeadingLabel(archetypeScores: ArchetypeScores): string {
    const entries: ArchetypeEntry[] = [
      { name: 'Sovereign', score: archetypeScores.Sovereign },
      { name: 'Empress', score: archetypeScores.Empress },
      { name: 'Consort', score: archetypeScores.Consort },
      { name: 'Seductress', score: archetypeScores.Seductress },
    ];

    const sorted = entries.sort((a, b) => a.score - b.score);
    const lowestScore = sorted[0].score;
    const leadingArchetypes = sorted.filter((e) => e.score <= lowestScore + 2);

    return leadingArchetypes.map((e) => e.name).join(' and ');
  }
}
