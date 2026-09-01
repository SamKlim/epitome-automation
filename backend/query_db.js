const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

async function getLastResponse() {
  const { data, error } = await supabase
    .from('survey_responses')
    .select('*')
    .order('date_created', { ascending: false })
    .limit(1);

  if (error) {
    console.error('Error:', error);
    return;
  }

  if (data && data.length > 0) {
    const response = data[0];
    console.log('First Name:', response.first_name);
    console.log('Last Name:', response.last_name);
    console.log('Email:', response.email);
    console.log('Organization:', response.organization);
    console.log('Archetype Scores:', response.archetype_scores);
  } else {
    console.log('No responses found');
  }
}

getLastResponse();
