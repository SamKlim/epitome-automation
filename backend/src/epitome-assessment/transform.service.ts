import { Injectable } from '@nestjs/common';
import questionsMap from '../maps/questions_map.json';

const ARCHETYPES = ['Sovereign', 'Empress', 'Consort', 'Seductress'] as const;
type Archetype = (typeof ARCHETYPES)[number];

export interface ArchetypeScores {
  Sovereign: number;
  Empress: number;
  Consort: number;
  Seductress: number;
}

@Injectable()
export class TransformService {
  private questionsMap: any[] = questionsMap;

  transform(rawResponse: unknown) {
    const response = rawResponse as Record<string, unknown>;

    const archetypeScores: ArchetypeScores = {
      Sovereign: 0,
      Empress: 0,
      Consort: 0,
      Seductress: 0,
    };

    const responses = this.buildResponses(response, archetypeScores);

    return {
      response_id: response.id as string,
      survey_id: response.surveyId as string,
      date_created: response.dateCreated as string,
      date_modified: response.dateModified as string,
      ip_address: response.ipAddress as string,
      duration_seconds: response.totalTime as number,
      collector_id: response.collectorId as string,
      response_status: response.responseStatus as string,
      contact: {
        first_name: (response.q_288881567 as Record<string, string[]> | undefined)?.q_2018891726?.[0] || '',
        last_name: (response.q_288881567 as Record<string, string[]> | undefined)?.q_2018891727?.[0] || '',
        email: (response.q_288881568 as Record<string, string[]> | undefined)?.q_2018891735?.[0] || '',
        organization: (response.q_288881569 as string) || '',
      },
      responses,
      archetype_scores: archetypeScores,
    };
  }

  private buildResponses(
    rawResponse: Record<string, unknown>,
    archetypeScores: ArchetypeScores,
  ): any[] {
    const responses: any[] = [];

    this.questionsMap.forEach((question) => {
      const questionId = `q_${question.question_id}`;
      const questionAnswers = rawResponse[questionId] as Record<string, string> | undefined;

      if (!questionAnswers) return;

      const answers = question.answers.map((answerOption: any) => {
        const subquestionId = answerOption.subquestion_id;
        const rankingStr = questionAnswers[subquestionId];
        const ranking = rankingStr ? parseInt(rankingStr, 10) : NaN;
        const validRanking = !isNaN(ranking) ? ranking : null;

        if (validRanking !== null) {
          const archetype = answerOption.archetype as Archetype;
          if (ARCHETYPES.includes(archetype)) {
            archetypeScores[archetype] += validRanking;
          }
        }

        return {
          subquestion_id: subquestionId,
          archetype: answerOption.archetype,
          statement: answerOption.statement,
          ranking: validRanking,
        };
      });

      responses.push({
        question_id: question.question_id,
        dimension: question.dimension,
        answers,
      });
    });

    return responses;
  }

}
