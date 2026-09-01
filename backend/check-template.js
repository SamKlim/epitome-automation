const { PDFDocument } = require('pdf-lib');
const fs = require('fs');
const path = require('path');

async function checkTemplate() {
  const templatePath = path.join(__dirname, 'src/templates/epitome-template.pdf');
  const pdfBuffer = fs.readFileSync(templatePath);
  const pdfDoc = await PDFDocument.load(pdfBuffer);

  const page1 = pdfDoc.getPage(0);
  console.log('Page 1 dimensions:');
  console.log('Width:', page1.getWidth());
  console.log('Height:', page1.getHeight());
  
  // Save unmodified page 1 to check original text position
  const testPath = path.join(__dirname, 'reports/template-check.pdf');
  fs.writeFileSync(testPath, await pdfDoc.save());
  
  console.log('\n✅ Template check saved to:', testPath);
  console.log('Open this PDF to locate "SALLY-ANN SAMPLE" position exactly');
}

checkTemplate();
