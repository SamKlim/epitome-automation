const { PDFDocument } = require('pdf-lib');
const fs = require('fs');
const path = require('path');

async function checkPDF() {
  const templatePath = path.join(__dirname, 'backend/src/templates/epitome-template.pdf');
  const pdfBuffer = fs.readFileSync(templatePath);
  const pdfDoc = await PDFDocument.load(pdfBuffer);
  
  const page1 = pdfDoc.getPage(0);
  console.log('Page 1 dimensions:');
  console.log('Width:', page1.getWidth());
  console.log('Height:', page1.getHeight());
  console.log('\nEstimated position of "SALLY-ANN SAMPLE":');
  console.log('- Horizontally centered around x: 300');
  console.log('- Vertically around y: 180-200');
  console.log('\nTo replace text at exact spot, we need to:');
  console.log('1. Cover old text with white rectangle');
  console.log('2. Draw new name at same coordinates');
}

checkPDF();
