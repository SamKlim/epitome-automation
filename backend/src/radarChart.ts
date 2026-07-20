// import { createCanvas } from 'skia-canvas';
// TODO: Install skia-canvas when implementing PDF generation

export const DIMENSIONS = [
  'Leading',
  'Trust',
  'Constraints',
  'Inspiration',
  'Managing Challenges',
  'Others View Me',
  'Striving',
  'Working With Peers',
  'At Your Worst',
  'Confidence',
  'Power',
  'Ambition',
];

export const ARCHETYPES = ['Sovereign', 'Empress', 'Consort', 'Seductress'];

const COLORS = {
  Sovereign: '#0B6889',
  Empress: '#603393',
  Consort: '#E7BF20',
  Seductress: '#C12026',
};

const MARKERS = {
  Sovereign: 'square',
  Empress: 'triangle',
  Consort: 'circle',
  Seductress: 'diamond',
};

interface ArchetypeScores {
  [key: string]: number[];
}

export async function generateRadarChart(
  scoresByArchetype: ArchetypeScores,
): Promise<Buffer> {
  throw new Error('Radar chart generation requires skia-canvas installation. TODO: implement when needed.');
}

function drawMarker(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  type: string,
  size: number,
): void {
  ctx.fillStyle = COLORS[Object.keys(COLORS)[Object.values(MARKERS).indexOf(type)]];

  switch (type) {
    case 'square':
      ctx.fillRect(x - size / 2, y - size / 2, size, size);
      break;
    case 'circle':
      ctx.beginPath();
      ctx.arc(x, y, size / 2, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'triangle':
      ctx.beginPath();
      ctx.moveTo(x, y - size / 2);
      ctx.lineTo(x + size / 2, y + size / 2);
      ctx.lineTo(x - size / 2, y + size / 2);
      ctx.closePath();
      ctx.fill();
      break;
    case 'diamond':
      ctx.beginPath();
      ctx.moveTo(x, y - size / 2);
      ctx.lineTo(x + size / 2, y);
      ctx.lineTo(x, y + size / 2);
      ctx.lineTo(x - size / 2, y);
      ctx.closePath();
      ctx.fill();
      break;
  }
}
