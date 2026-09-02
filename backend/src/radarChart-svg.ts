import sharp from 'sharp';

const ARCHETYPES = ['Sovereign', 'Empress', 'Consort', 'Seductress'];

const COLORS = {
  Sovereign: '#0B6889',
  Empress: '#603393',
  Consort: '#E7BF20',
  Seductress: '#C12026',
};

interface DimensionScores {
  dimension: string;
  Sovereign: 1 | 2 | 3 | 4;
  Empress: 1 | 2 | 3 | 4;
  Consort: 1 | 2 | 3 | 4;
  Seductress: 1 | 2 | 3 | 4;
}

// Test data (same as original)
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

export async function generateRadarChartSvg(
  scoresByArchetype?: DimensionScores[],
): Promise<Buffer> {
  const data = scoresByArchetype || dimensionData;
  const svgString = generateRadarChartSvgString(data);

  // Convert SVG to PNG using sharp
  const pngBuffer = await sharp(Buffer.from(svgString)).png().toBuffer();
  return pngBuffer;
}

function generateRadarChartSvgString(data: DimensionScores[]): string {
  const numDimensions = data.length;
  const maxRadius = 380;
  const labelDistance = maxRadius + 55;
  const angleSlice = (Math.PI * 2) / numDimensions;
  const fontSize = 26;

  // Calculate bounding box
  let tempCenterX = 1000;
  let tempCenterY = 1000;

  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity;

  // Check bounds for circles
  for (let i = 1; i <= 4; i++) {
    const radius = (maxRadius / 4) * i;
    minX = Math.min(minX, tempCenterX - radius);
    maxX = Math.max(maxX, tempCenterX + radius);
    minY = Math.min(minY, tempCenterY - radius);
    maxY = Math.max(maxY, tempCenterY + radius);
  }

  // Check bounds for labels
  data.forEach((dim, i) => {
    const angle = angleSlice * i - Math.PI / 2;
    const labelX = tempCenterX + labelDistance * Math.cos(angle);
    const labelY = tempCenterY + labelDistance * Math.sin(angle);

    const textWidth = dim.dimension.length * (fontSize * 0.5);
    const textHeight = fontSize;

    let textMinX = labelX - textWidth / 2;
    let textMaxX = labelX + textWidth / 2;

    if (Math.cos(angle) > 0.3) {
      textMinX = labelX;
      textMaxX = labelX + textWidth;
    } else if (Math.cos(angle) < -0.3) {
      textMinX = labelX - textWidth;
      textMaxX = labelX;
    }

    minX = Math.min(minX, textMinX);
    maxX = Math.max(maxX, textMaxX);
    minY = Math.min(minY, labelY - textHeight / 2);
    maxY = Math.max(maxY, labelY + textHeight / 2);
  });

  const padding = 20;
  minX -= padding;
  maxX += padding;
  minY -= padding;
  maxY += padding;

  const canvasWidth = Math.ceil(maxX - minX);
  const canvasHeight = Math.ceil(maxY - minY);
  const offsetX = -minX;
  const offsetY = -minY;
  const centerX = tempCenterX + offsetX;
  const centerY = tempCenterY + offsetY;

  // Start building SVG
  let svgElements: string[] = [];

  // Background
  svgElements.push(`<rect width="${canvasWidth}" height="${canvasHeight}" fill="white" />`);

  // Draw concentric circles
  for (let i = 1; i <= 4; i++) {
    const radius = (maxRadius / 4) * i;
    svgElements.push(
      `<circle cx="${centerX}" cy="${centerY}" r="${radius}" fill="none" stroke="#999999" stroke-width="1" />`
    );
  }

  // Calculate points for each archetype
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
    svgElements.push(
      `<line x1="${centerX}" y1="${centerY}" x2="${x}" y2="${y}" stroke="#cccccc" stroke-width="3" />`
    );

    // Add dimension label
    const labelX = centerX + labelDistance * Math.cos(angle);
    const labelY = centerY + labelDistance * Math.sin(angle);

    let textAnchor = 'middle';
    if (Math.cos(angle) > 0.3) {
      textAnchor = 'start';
    } else if (Math.cos(angle) < -0.3) {
      textAnchor = 'end';
    }

    svgElements.push(
      `<text x="${labelX}" y="${labelY}" font-size="${fontSize}" font-family="Helvetica" text-anchor="${textAnchor}" dominant-baseline="middle" fill="black">${dim.dimension}</text>`
    );

    // Calculate points for each archetype
    ARCHETYPES.forEach((archetype) => {
      const score = dim[archetype];
      const radius = (maxRadius / 4) * score;
      const pointX = centerX + radius * Math.cos(angle);
      const pointY = centerY + radius * Math.sin(angle);
      points[archetype].push({ x: pointX, y: pointY });
    });
  });

  // Draw polygons for each archetype
  ARCHETYPES.forEach((archetype) => {
    const archetypePoints = points[archetype];
    const pointsString = archetypePoints.map((p) => `${p.x},${p.y}`).join(' ');

    // Polygon outline
    svgElements.push(
      `<polygon points="${pointsString}" fill="none" stroke="${COLORS[archetype]}" stroke-width="5" />`
    );

    // Markers at vertices
    archetypePoints.forEach((point) => {
      svgElements.push(
        `<circle cx="${point.x}" cy="${point.y}" r="11" fill="${COLORS[archetype]}" />`
      );
    });
  });

  const svgString = `
    <svg width="${canvasWidth}" height="${canvasHeight}" xmlns="http://www.w3.org/2000/svg">
      ${svgElements.join('\n      ')}
    </svg>
  `;

  return svgString;
}
