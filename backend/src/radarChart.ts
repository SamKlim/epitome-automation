import { Canvas } from 'skia-canvas';
import * as fs from 'fs';
import * as path from 'path';

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
  Sovereign: 'diamond',
  Empress: 'diamond',
  Consort: 'diamond',
  Seductress: 'diamond',
};

interface DimensionScores {
  dimension: string;
  Sovereign: 1 | 2 | 3 | 4;
  Empress: 1 | 2 | 3 | 4;
  Consort: 1 | 2 | 3 | 4;
  Seductress: 1 | 2 | 3 | 4;
}

// Dummy data: each dimension has scores 1-4 distributed among archetypes
const dimensionData: DimensionScores[] = [
  { dimension: 'Leading', Sovereign: 4, Empress: 1, Consort: 2, Seductress: 3 },
  { dimension: 'Trust', Sovereign: 2, Empress: 4, Consort: 1, Seductress: 3 },
  { dimension: 'Constraints', Sovereign: 1, Empress: 3, Consort: 4, Seductress: 2 },
  { dimension: 'Inspiration', Sovereign: 3, Empress: 2, Consort: 1, Seductress: 4 },
  { dimension: 'Managing Challenges', Sovereign: 4, Empress: 2, Consort: 3, Seductress: 1 },
  { dimension: 'Others View Me', Sovereign: 2, Empress: 3, Consort: 4, Seductress: 1 },
  { dimension: 'Striving', Sovereign: 3, Empress: 4, Consort: 2, Seductress: 1 },
  { dimension: 'Working With Peers', Sovereign: 1, Empress: 2, Consort: 4, Seductress: 3 },
  { dimension: 'At Your Worst', Sovereign: 2, Empress: 1, Consort: 3, Seductress: 4 },
  { dimension: 'Confidence', Sovereign: 4, Empress: 3, Consort: 1, Seductress: 2 },
  { dimension: 'Power', Sovereign: 3, Empress: 4, Consort: 1, Seductress: 2 },
  { dimension: 'Ambition', Sovereign: 4, Empress: 2, Consort: 1, Seductress: 3 },
];

export async function generateRadarChart(
  scoresByArchetype?: DimensionScores[],
): Promise<Buffer> {
  const data = scoresByArchetype || dimensionData;
  return generateRadarChartPNG(data);
}


function generateRadarChartPNG(data: DimensionScores[]): Promise<Buffer> {
  return new Promise((resolve) => {
    const numDimensions = data.length;
    const maxRadius = 380;
    const labelDistance = maxRadius + 55; // 435 pixels from center
    const angleSlice = (Math.PI * 2) / numDimensions;
    const fontSize = 26;

    // Temporary center for calculating bounds
    let tempCenterX = 1000;
    let tempCenterY = 1000;

    // Calculate bounding box of all content
    let minX = Infinity,
      maxX = -Infinity,
      minY = Infinity,
      maxY = -Infinity;

    // Check bounds for chart circles and axes
    for (let i = 1; i <= 4; i++) {
      const radius = (maxRadius / 4) * i;
      minX = Math.min(minX, tempCenterX - radius);
      maxX = Math.max(maxX, tempCenterX + radius);
      minY = Math.min(minY, tempCenterY - radius);
      maxY = Math.max(maxY, tempCenterY + radius);
    }

    // Check bounds for labels (estimate text width)
    data.forEach((dim, i) => {
      const angle = angleSlice * i - Math.PI / 2;
      const labelX = tempCenterX + labelDistance * Math.cos(angle);
      const labelY = tempCenterY + labelDistance * Math.sin(angle);

      // Estimate text bounds (rough approximation)
      const textWidth = dim.dimension.length * (fontSize * 0.5);
      const textHeight = fontSize;

      // Adjust bounds based on text alignment
      let textMinX = labelX - textWidth / 2;
      let textMaxX = labelX + textWidth / 2;

      if (Math.cos(angle) > 0.3) {
        // Left-aligned: text extends right
        textMinX = labelX;
        textMaxX = labelX + textWidth;
      } else if (Math.cos(angle) < -0.3) {
        // Right-aligned: text extends left
        textMinX = labelX - textWidth;
        textMaxX = labelX;
      }

      minX = Math.min(minX, textMinX);
      maxX = Math.max(maxX, textMaxX);
      minY = Math.min(minY, labelY - textHeight / 2);
      maxY = Math.max(maxY, labelY + textHeight / 2);
    });

    // Add padding (small margin)
    const padding = 20;
    minX -= padding;
    maxX += padding;
    minY -= padding;
    maxY += padding;

    // Calculate canvas size and offset
    const canvasWidth = Math.ceil(maxX - minX);
    const canvasHeight = Math.ceil(maxY - minY);
    const offsetX = -minX;
    const offsetY = -minY;
    const centerX = tempCenterX + offsetX;
    const centerY = tempCenterY + offsetY;

    const canvas = new Canvas(canvasWidth, canvasHeight);
    const ctx = canvas.getContext('2d') as any;

    // Background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // Draw concentric circles (grid)
    ctx.strokeStyle = '#999999';
    ctx.lineWidth = 1;
    for (let i = 1; i <= 4; i++) {
      const radius = (maxRadius / 4) * i;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Draw axes and labels
    ctx.strokeStyle = '#cccccc';
    ctx.lineWidth = 3;
    ctx.fillStyle = '#000000';
    ctx.font = '26px Helvetica';
    ctx.textAlign = 'center';

    const points: { [archetype: string]: { x: number; y: number }[] } = {
      Sovereign: [],
      Empress: [],
      Consort: [],
      Seductress: [],
    };

    data.forEach((dim, i) => {
      const angle = angleSlice * i - Math.PI / 2;
      const x = centerX + maxRadius * Math.cos(angle);
      const y = centerY + maxRadius * Math.sin(angle);

      // Draw axis line
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(x, y);
      ctx.stroke();

      // Add dimension label with consistent distance from chart
      const labelDistance = maxRadius + 55; // Consistent spacing for all labels
      const labelX = centerX + labelDistance * Math.cos(angle);
      const labelY = centerY + labelDistance * Math.sin(angle);

      // Determine text alignment based on angle to keep text radiating outward
      if (Math.cos(angle) > 0.3) {
        ctx.textAlign = 'left';
      } else if (Math.cos(angle) < -0.3) {
        ctx.textAlign = 'right';
      } else {
        ctx.textAlign = 'center';
      }

      ctx.fillText(dim.dimension, labelX, labelY);

      // Calculate points for each archetype
      ARCHETYPES.forEach((archetype) => {
        const score = dim[archetype];
        const radius = (maxRadius / 4) * score;
        const pointX = centerX + radius * Math.cos(angle);
        const pointY = centerY + radius * Math.sin(angle);
        points[archetype].push({ x: pointX, y: pointY });
      });
    });

    // Draw polygons for each archetype (no shading, just outlines)
    ARCHETYPES.forEach((archetype) => {
      ctx.strokeStyle = COLORS[archetype];
      ctx.lineWidth = 5;

      ctx.beginPath();
      points[archetype].forEach((point, i) => {
        if (i === 0) {
          ctx.moveTo(point.x, point.y);
        } else {
          ctx.lineTo(point.x, point.y);
        }
      });
      ctx.closePath();
      ctx.stroke();

      // Draw markers at vertices with archetype color
      points[archetype].forEach((point) => {
        drawMarkerColored(ctx, point.x, point.y, MARKERS[archetype], 22, COLORS[archetype]);
      });
    });

    // Convert to PNG buffer
    const buffer = (canvas as any).png;
    resolve(buffer);
  });
}


function drawMarkerColored(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  type: string,
  size: number,
  color: string,
): void {
  ctx.fillStyle = color;

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
