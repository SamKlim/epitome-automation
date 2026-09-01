const { createClient } = require('@supabase/supabase-js');
const { PDFDocument, rgb } = require('pdf-lib');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

async function generatePDF() {
  const { data } = await supabase
    .from('survey_responses')
    .select('first_name, last_name, archetype_scores, response_id')
    .ilike('first_name', '%Sam%')
    .limit(1);

  if (!data || data.length === 0) return;

  const response = data[0];
  const scores = response.archetype_scores;
  const entries = [
    { name: 'Sovereign', score: scores.Sovereign },
    { name: 'Empress', score: scores.Empress },
    { name: 'Consort', score: scores.Consort },
    { name: 'Seductress', score: scores.Seductress },
  ];
  const sorted = entries.sort((a, b) => a.score - b.score);
  const lowestScore = sorted[0].score;
  const leadingArchetypes = sorted.filter((e) => e.score <= lowestScore + 2);
  const archetypeLabel = leadingArchetypes.map((e) => e.name).join(' and ');

  const templatePath = path.join(__dirname, 'src/templates/epitome-template.pdf');
  const pdfBuffer = fs.readFileSync(templatePath);
  const pdfDoc = await PDFDocument.load(pdfBuffer);

  // Page 1 - Cover SALLY-ANN SAMPLE at exact position (x=231, y=746)
  const page1 = pdfDoc.getPage(0);
  const clientName = `${response.first_name} ${response.last_name}`;
  
  page1.drawRectangle({
    x: 221,
    y: 746,
    width: 168,
    height: 36,
    color: rgb(0.96, 0.95, 0.92), // Cream
  });
  
  page1.drawText(clientName, {
    x: 231,
    y: 760,
    size: 14,
    color: rgb(0, 0, 0),
  });

  // Page 8 - Replace archetype
  const page8 = pdfDoc.getPage(7);
  page8.drawRectangle({
    x: 40,
    y: 675,
    width: 520,
    height: 45,
    color: rgb(0.96, 0.95, 0.92),
  });

  const archetypes = archetypeLabel.split(' and ');
  if (archetypes.length === 1) {
    page8.drawText(`You tend to lead with the ${archetypeLabel.toUpperCase()}.`, {
      x: 50, y: 695, size: 16, color: rgb(0, 0, 0),
    });
  } else {
    const firstArchetype = archetypes[0].trim().toUpperCase();
    const restArchetypes = archetypes.slice(1).map((a) => `the ${a.trim().toUpperCase()}`).join(' AND ');
    page8.drawText(`You tend to lead with the ${firstArchetype}`, {
      x: 50, y: 705, size: 16, color: rgb(0, 0, 0),
    });
    page8.drawText(`AND ${restArchetypes}.`, {
      x: 50, y: 690, size: 16, color: rgb(0, 0, 0),
    });
  }

  const reportsDir = path.join(__dirname, 'reports');
  if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });

  const filePath = path.join(reportsDir, `epitome-report-${response.response_id}.pdf`);
  fs.writeFileSync(filePath, await pdfDoc.save());

  console.log(`✅ PDF generated with precise coordinates:`);
  console.log(`   Client: ${clientName}`);
  console.log(`   Archetype: ${archetypeLabel}`);
  console.log(`   File: ${filePath}`);
}

generatePDF().catch(console.error);
