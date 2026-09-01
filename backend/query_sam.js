const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

async function getSamResponse() {
  const { data, error } = await supabase
    .from('survey_responses')
    .select('first_name, last_name, email, organization, archetype_scores')
    .ilike('first_name', '%Sam%')
    .limit(1);

  if (error) {
    console.error('Error:', error);
    return;
  }

  if (data && data.length > 0) {
    const response = data[0];
    console.log('=== SAM\'S DATA ===');
    console.log('Name:', response.first_name, response.last_name);
    console.log('Email:', response.email);
    console.log('Organization:', response.organization);
    console.log('Archetype Scores:', JSON.stringify(response.archetype_scores, null, 2));
  } else {
    console.log('No responses found for Sam');
  }
}

getSamResponse();
