import { getArchetypeLabel } from './archetype-label';
import { SURVEY_FIXTURES } from '../../tests/fixtures/e2e-survey-response';

describe('getArchetypeLabel', () => {
  it('picks the lowest total because ranking 1 means "fully describes me"', () => {
    const label = getArchetypeLabel({ Sovereign: 40, Empress: 20, Consort: 35, Seductress: 30 });
    expect(label).toBe('Empress');
  });

  it('joins archetypes within 2 points of the lowest, lowest first', () => {
    const label = getArchetypeLabel({ Sovereign: 22, Empress: 20, Consort: 35, Seductress: 30 });
    expect(label).toBe('Empress and Sovereign');
  });

  it('excludes an archetype exactly 3 points above the lowest', () => {
    const label = getArchetypeLabel({ Sovereign: 23, Empress: 20, Consort: 35, Seductress: 30 });
    expect(label).toBe('Empress');
  });

  it.each(SURVEY_FIXTURES)('labels fixture "$name" correctly', (fixture) => {
    expect(getArchetypeLabel(fixture.expectedTotals)).toBe(fixture.expectedLabel);
  });

  it('throws when scores are missing entirely', () => {
    expect(() => getArchetypeLabel(null)).toThrow(/archetype_scores is missing/);
  });

  it('throws when one archetype has no score', () => {
    const partial = { Sovereign: 30, Empress: 29, Consort: 34 } as never;
    expect(() => getArchetypeLabel(partial)).toThrow(/Seductress score is missing/);
  });
});
