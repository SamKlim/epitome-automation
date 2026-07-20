import { Injectable } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService {
  private supabase: SupabaseClient;

  constructor() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_ANON_KEY;

    if (!url || !key) {
      throw new Error(
        'Missing required environment variables: SUPABASE_URL and SUPABASE_ANON_KEY',
      );
    }

    this.supabase = createClient(url, key);
  }

  getClient(): SupabaseClient {
    return this.supabase;
  }

  async insertSurveyResponse(data: any) {
    const { data: result, error } = await this.supabase
      .from('survey_responses')
      .insert([data]);

    if (error) {
      throw new Error(`Failed to insert survey response: ${error.message}`);
    }

    return result;
  }

  async getSurveyStructure() {
    const { data, error } = await this.supabase
      .from('survey_structure')
      .select('*');

    if (error) {
      throw new Error(`Failed to fetch survey structure: ${error.message}`);
    }

    return data;
  }
}
