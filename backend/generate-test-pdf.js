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
  // Get Sam's data
  const { data, error } = await supabase
    .from('survey_responses')
    .select('first_name, last_name, archetype_scores, response_id')
    .ilike('first_name', '%Sam%')
    .limit(1);

  if (error || !data || data.length === 0) {
    console.error('Error fetching data:', error);
    return;
  }

  const response = data[0];
  console.log('Loading Sam\'s data...');
  console.log('Name:', response.first_name, response.last_name);

  // Calculate archetype label
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

  console.log('Archetype Label:', archetypeLabel);

  // Load template PDF
  const templatePath = path.join(__dirname, 'src/templates/epitome-template.pdf');
  const pdfBuffer = fs.readFileSync(templatePath);
  const pdfDoc = await PDFDocument.load(pdfBuffer);

  // Page 1: Replace SALLY-ANN SAMPLE with client name (exact same spot)
  const page1 = pdfDoc.getPage(0);
  const clientName = `${response.first_name} ${response.last_name}`;
  
  // Cover old text with white rectangle
  page1.drawRectangle({
    x: 200,
    y: 140,
    width: 400,
    height: 40,
    color: rgb(1, 1, 1), // Cream background matching template
  });
  
  // Draw new name in exact same position as SALLY-ANN SAMPLE
  page1.drawText(clientName, {
    x: 250,
    y: 155,
    size: 22,
    color: rgb(0, 0, 0),
  });

  // Page 8: Add archetype label
  const page8 = pdfDoc.getPage(7);
  const archetypes = archetypeLabel.split(' and ');
  if (archetypes.length === 1) {
    page8.drawText(`You tend to lead with the ${archetypeLabel.toUpperCase()}.`, {
      x: 100,
      y: 700,
      size: 16,
      color: rgb(0, 0, 0),
    });
  } else {
    const firstArchetype = archetypes[0].trim().toUpperCase();
    const restArchetypes = archetypes
      .slice(1)
      .map((a) => `the ${a.trim().toUpperCase()}`)
      .join(' AND ');
    page8.drawText(`You tend to lead with the ${firstArchetype}`, {
      x: 100,
      y: 710,
      size: 16,
      color: rgb(0, 0, 0),
    });
    page8.drawText(`AND ${restArchetypes}.`, {
      x: 100,
      y: 690,
      size: 16,
      color: rgb(0, 0, 0),
    });
  }

  // Save PDF
  const reportsDir = path.join(__dirname, 'reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  const fileName = `epitome-report-${response.response_id}.pdf`;
  const filePath = path.join(reportsDir, fileName);

  const pdfBytes = await pdfDoc.save();
  fs.writeFileSync(filePath, pdfBytes);

  console.log(`✅ PDF regenerated: ${filePath}`);
  console.log(`📂 Reports folder: ${reportsDir}`);
}

generatePDF().catch(console.error);
