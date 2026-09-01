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

  const page1 = pdfDoc.getPage(0);
  const clientName = `${response.first_name} ${response.last_name}`.toUpperCase();
  const bgColor = rgb(0.98, 0.97, 0.95);
  
  // BOX 1: Large rectangle
  page1.drawRectangle({
    x: 200,
    y: 70,
    width: 220,
    height: 30,
    color: bgColor,
  });
  
  // Calculate text dimensions
  const charWidth = 14 * 0.45;
  const textWidth = clientName.length * charWidth;
  const padding = 4;
  const fontSize = 14;
  const boxHeight = 30;
  
  // Wrap text tightly, then add padding
  const centerPageX = (200 + 420) / 2;
  const textBoxX = centerPageX - (textWidth / 2);
  const textBoxY = 70 + (boxHeight / 2) - (fontSize / 2);
  
  // Padded box
  const boxX = textBoxX - padding;
  const boxY = 70;
  const boxWidth = textWidth + (padding * 2);
  
  page1.drawRectangle({
    x: boxX,
    y: boxY,
    width: boxWidth,
    height: boxHeight,
    color: bgColor,
  });
  
  // Draw text
  page1.drawText(clientName, {
    x: textBoxX,
    y: textBoxY,
    size: fontSize,
    color: rgb(0, 0, 0),
  });

  // Page 8
  const page8 = pdfDoc.getPage(7);
  page8.drawRectangle({
    x: 40,
    y: 675,
    width: 520,
    height: 45,
    color: bgColor,
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

  console.log(`✅ PDF updated - text wrapped then padded`);
}

generatePDF().catch(console.error);
