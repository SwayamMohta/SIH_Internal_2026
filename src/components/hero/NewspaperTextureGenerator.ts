import * as THREE from 'three';

export interface NewspaperDesignConfig {
  masthead: string;
  subMasthead: string;
  headline: string;
  subheadline: string;
  tagline: string;
  edition: string;
  volume: string;
  date: string;
  price: string;
  accentColor?: string;
  woodcutTheme?: 'crest' | 'press' | 'compass' | 'seal' | 'eagle';
}

export const NEWSPAPER_CONFIGS: NewspaperDesignConfig[] = [
  {
    masthead: 'THE MORNING HERALD',
    subMasthead: 'THE SOVEREIGN RECORD OF REGISTERED PERIODICALS',
    headline: 'A NAME BEFORE A NEWSPAPER',
    subheadline: 'Continuous Web Press Spools Thousand-Yard Broadside Cylinders Across the Realm',
    tagline: 'Truth in Inscription • Recorded in Perpetual National Archive',
    edition: 'FINAL CITY EXTRA',
    volume: 'VOL. CLXXXIV — NO. 54,201',
    date: 'OCTOBER 14, 1888',
    price: 'TWO PENCE',
    accentColor: '#8b0000',
    woodcutTheme: 'crest'
  },
  {
    masthead: 'THE NATIONAL CHRONICLE',
    subMasthead: 'DISPATCHES OF THE ROYAL TITLE REGISTRY & GAZETTE',
    headline: 'ROTARY CYLINDER PRESS REVOLUTION',
    subheadline: 'High-Speed Web Feed Delivers Endless Stream of Printed Broadsheets',
    tagline: 'Perpetual Vigilance in Orthographic Clearance and Inscription',
    edition: 'MIDLAND EDITION',
    volume: 'VOL. XCI — NO. 28,104',
    date: 'NOVEMBER 02, 1894',
    price: 'ONE PENNY',
    accentColor: '#1e3a8a',
    woodcutTheme: 'press'
  },
  {
    masthead: 'THE EVENING REGISTER',
    subMasthead: 'STATUTORY EXAMINATION & PRECEDENT ARCHIVES',
    headline: 'PHONETIC COLLISIONS IN PRINT',
    subheadline: 'Deterministic Analysis Prevents Periodical Confusion Across Provinces',
    tagline: 'The First Authority in Title Integrity & Linguistic Distinction',
    edition: 'LATE DISPATCH',
    volume: 'VOL. CCVI — NO. 61,409',
    date: 'SEPTEMBER 19, 1902',
    price: 'THREE HALFPENCE',
    accentColor: '#b45309',
    woodcutTheme: 'seal'
  },
  {
    masthead: 'THE CITY DISPATCH',
    subMasthead: 'OFFICIAL RECORD OF INDUSTRIAL & EDITORIAL COMMERCE',
    headline: 'THE ARCHIVE OF SOVEREIGN TITLES',
    subheadline: 'Every Registered Name Safeguarded Against Duplicate Inscription',
    tagline: 'Printed Direct From Continuous Cast-Iron Cylinders',
    edition: 'SPECIAL TELEGRAPH',
    volume: 'VOL. LXXIV — NO. 19,850',
    date: 'JANUARY 28, 1911',
    price: 'ONE PENNY',
    accentColor: '#065f46',
    woodcutTheme: 'compass'
  },
  {
    masthead: 'THE CONTINENTAL GAZETTE',
    subMasthead: 'TRANS-MARITIME INTELLECTUAL PROPERTY & PRESS CODEX',
    headline: 'ENDLESS WEB OF NEWSPRINT SPOOLS',
    subheadline: 'Giant Reels of Nordic Pulp Feed High-Capacity Rotary Rollers',
    tagline: 'A Century of Archival Stewardship and Precedent',
    edition: 'OVERSEAS ISSUE',
    volume: 'VOL. CXII — NO. 33,712',
    date: 'AUGUST 15, 1924',
    price: 'FOUR PENCE',
    accentColor: '#701a75',
    woodcutTheme: 'eagle'
  },
  {
    masthead: 'THE METROPOLITAN POST',
    subMasthead: 'DAILY BROADSIDE OF JURISPRUDENCE & STATUTORY CODE',
    headline: 'CLEARANCE FOR FIRST EDITION',
    subheadline: 'All Verified Titles Enter Perpetual Record with Full Statutory Protection',
    tagline: 'The Voice of Sovereign Registry & Editorial Precedent',
    edition: 'CAPITAL MORNING',
    volume: 'VOL. XLIX — NO. 14,028',
    date: 'DECEMBER 03, 1930',
    price: 'TWO PENCE',
    accentColor: '#9f1239',
    woodcutTheme: 'crest'
  }
];

/**
 * Creates an authentic continuous newsprint texture with repeating high-impact editorial broadsheets
 */
export function createNewspaperTexture(config: NewspaperDesignConfig, index = 0): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  // High definition broadsheet canvas: 1024 width, 4096 length (3 repeating full pages)
  const width = 1024;
  const height = 4096;
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.CanvasTexture(canvas);

  // Background: Warm off-white newsprint paper with natural variations
  const bgGrad = ctx.createLinearGradient(0, 0, width, height);
  const paperColors = [
    ['#f6f0e2', '#eae2d0', '#f4eedb'],
    ['#f7f2e6', '#ebe1cd', '#f2ebda'],
    ['#f5efe1', '#e8dec8', '#eee5d2'],
    ['#f8f4eb', '#eee4d4', '#f3ebd9'],
    ['#f4ede0', '#e9ddc5', '#eee3cd'],
    ['#f6f1e5', '#eae1cf', '#f4ebd8']
  ];
  const colSet = paperColors[index % paperColors.length];
  bgGrad.addColorStop(0, colSet[0]);
  bgGrad.addColorStop(0.5, colSet[1]);
  bgGrad.addColorStop(1, colSet[2]);

  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // Side paper margins (paper strip edge vignette)
  const edgeGradL = ctx.createLinearGradient(0, 0, 32, 0);
  edgeGradL.addColorStop(0, 'rgba(30, 20, 10, 0.22)');
  edgeGradL.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = edgeGradL;
  ctx.fillRect(0, 0, 32, height);

  const edgeGradR = ctx.createLinearGradient(width - 32, 0, width, 0);
  edgeGradR.addColorStop(0, 'rgba(0, 0, 0, 0)');
  edgeGradR.addColorStop(1, 'rgba(30, 20, 10, 0.22)');
  ctx.fillStyle = edgeGradR;
  ctx.fillRect(width - 32, 0, 32, height);

  // Paper noise & subtle vintage grain
  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;
  for (let i = 0; i < data.length; i += 4) {
    const noise = (Math.random() - 0.5) * 16;
    data[i] = Math.min(255, Math.max(0, data[i] + noise));
    data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + noise - 1));
    data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + noise - 4));
  }
  ctx.putImageData(imgData, 0, 0);

  // Render 3 continuous broadsheet sections down the length
  const pageHeight = Math.floor(height / 3);
  for (let p = 0; p < 3; p++) {
    const yOff = p * pageHeight;
    renderPageSection(ctx, config, yOff, width, pageHeight, p);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.anisotropy = 8;

  return texture;
}

function renderPageSection(
  ctx: CanvasRenderingContext2D,
  config: NewspaperDesignConfig,
  y: number,
  w: number,
  h: number,
  pageIndex: number
) {
  const pad = 52;
  const contentW = w - pad * 2;

  // Outer border rules
  ctx.strokeStyle = '#101114';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(pad - 16, y + 24, contentW + 32, h - 48);

  ctx.strokeStyle = 'rgba(16, 17, 20, 0.4)';
  ctx.lineWidth = 0.8;
  ctx.strokeRect(pad - 12, y + 28, contentW + 24, h - 56);

  // Header meta bar (Volume, Section, Date, Price)
  ctx.fillStyle = '#111215';
  ctx.font = '600 14px "JetBrains Mono", monospace';
  ctx.textAlign = 'left';
  ctx.fillText(`${config.volume} • SECTION ${pageIndex + 1}`, pad, y + 54);

  ctx.textAlign = 'center';
  ctx.fillStyle = config.accentColor || '#8b0000';
  ctx.font = '900 14px "Cinzel", Georgia, serif';
  ctx.fillText(`★ ${config.edition} ★`, w / 2, y + 54);

  ctx.textAlign = 'right';
  ctx.fillStyle = '#111215';
  ctx.font = '600 14px "JetBrains Mono", monospace';
  ctx.fillText(`${config.date} • ${config.price}`, w - pad, y + 54);

  // Double border below meta
  ctx.strokeStyle = '#101114';
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.moveTo(pad - 16, y + 68);
  ctx.lineTo(w - pad + 16, y + 68);
  ctx.stroke();

  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(pad - 16, y + 74);
  ctx.lineTo(w - pad + 16, y + 74);
  ctx.stroke();

  // GRAND MASTHEAD (Heavy black ink, bold serif)
  ctx.fillStyle = '#0a0b0e';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '900 78px "Cinzel", "Playfair Display", Georgia, serif';
  ctx.letterSpacing = '3px';
  ctx.fillText(config.masthead, w / 2, y + 140);

  // Sub-masthead
  ctx.font = 'bold 13.5px "Plus Jakarta Sans", -apple-system, sans-serif';
  ctx.fillStyle = '#2d2b27';
  ctx.letterSpacing = '3.5px';
  ctx.fillText(config.subMasthead, w / 2, y + 195);

  // Tagline italic
  ctx.font = 'italic 15px "Newsreader", Georgia, serif';
  ctx.fillStyle = '#4c473e';
  ctx.letterSpacing = '1px';
  ctx.fillText(`“${config.tagline}”`, w / 2, y + 222);

  // Broad double rule under masthead
  ctx.strokeStyle = '#101114';
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.moveTo(pad - 16, y + 245);
  ctx.lineTo(w - pad + 16, y + 245);
  ctx.stroke();

  // Editorial banner ribbon
  ctx.fillStyle = 'rgba(16, 17, 20, 0.08)';
  ctx.fillRect(pad - 16, y + 249, contentW + 32, 28);
  ctx.fillStyle = '#141518';
  ctx.font = 'bold 12px "JetBrains Mono", monospace';
  ctx.textAlign = 'left';
  ctx.fillText('PRGI NATIONAL REGISTRY ARCHIVE', pad, y + 268);
  ctx.textAlign = 'center';
  ctx.fillText('• DETERMINISTIC LINGUISTIC CLEARANCE •', w / 2, y + 268);
  ctx.textAlign = 'right';
  ctx.fillText('HIGH-CAPACITY CYLINDER ROTARY PRESS', w - pad, y + 268);

  ctx.strokeStyle = '#101114';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(pad - 16, y + 280);
  ctx.lineTo(w - pad + 16, y + 280);
  ctx.stroke();

  // GIANT HEADLINE (High impact, minimal text, bold authority)
  const headlines = [
    config.headline,
    'ENDLESS STREAM OF PRINTED BROADSHEETS',
    'CLEARANCE VERIFIED IN PERPETUAL LEDGER'
  ];
  const curHeadline = headlines[pageIndex % headlines.length];

  ctx.textAlign = 'center';
  ctx.fillStyle = '#060709';
  ctx.font = '900 58px "Playfair Display", "Newsreader", Georgia, serif';
  ctx.fillText(curHeadline, w / 2, y + 346);

  // Subheadline in italic
  ctx.font = 'italic 22px "Newsreader", Georgia, serif';
  ctx.fillStyle = '#262420';
  ctx.fillText(config.subheadline, w / 2, y + 398);

  // Thin separator rule
  ctx.strokeStyle = 'rgba(16, 17, 20, 0.4)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(pad + 60, y + 424);
  ctx.lineTo(w - pad - 60, y + 424);
  ctx.stroke();

  // 3-Column Editorial Grid (Clean, aesthetic, authentic)
  const numCols = 3;
  const colGap = 32;
  const colW = (contentW - colGap * (numCols - 1)) / numCols;
  const colStartY = y + 446;
  const colH = h - 490;

  for (let c = 0; c < numCols; c++) {
    const colX = pad + c * (colW + colGap);

    // Vertical column rule divider
    if (c > 0) {
      ctx.strokeStyle = 'rgba(16, 17, 20, 0.22)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(colX - colGap / 2, colStartY - 10);
      ctx.lineTo(colX - colGap / 2, colStartY + colH);
      ctx.stroke();
    }

    if (c === 0) {
      // Column 1: Lead Story with Drop Cap
      ctx.fillStyle = '#101114';
      ctx.font = 'bold 17px "Playfair Display", serif';
      ctx.textAlign = 'left';
      ctx.fillText('DISPATCH FROM THE REGISTRAR', colX, colStartY + 14);

      // Drop Cap
      ctx.font = '900 60px "Cinzel", "Playfair Display", serif';
      ctx.fillStyle = config.accentColor || '#8b0000';
      ctx.fillText('B', colX, colStartY + 76);

      ctx.fillStyle = '#1f2024';
      ctx.font = '14px/1.55 "Newsreader", Georgia, serif';
      const leadLines = [
        '  efore any periodical enters public',
        '  circulation, its title is recorded in',
        'the sovereign registry. High-speed cylinder',
        'presses deliver unbroken ribbons of newsprint',
        'across all provincial territories without delay.',
        '',
        'The continuous paper feed ensures that every',
        'inscription remains uniform in density, weight,',
        'and statutory compliance across centuries.'
      ];
      let lineY = colStartY + 46;
      for (const line of leadLines) {
        ctx.fillText(line, colX + (lineY < colStartY + 84 ? 42 : 0), lineY);
        lineY += 23;
      }

      // Simulated Woodcut Seal
      drawWoodcutSeal(ctx, colX + colW / 2, colStartY + colH - 85, 54, config.accentColor);

    } else if (c === 1) {
      // Column 2: Center Woodcut Illustration / Engraving Box
      const imgBoxH = 220;
      ctx.strokeStyle = '#101114';
      ctx.lineWidth = 2.5;
      ctx.strokeRect(colX, colStartY + 5, colW, imgBoxH);

      drawWoodcutEngraving(ctx, colX + 4, colStartY + 9, colW - 8, imgBoxH - 8, config.woodcutTheme || 'press');

      // Caption
      ctx.fillStyle = '#423e35';
      ctx.font = 'italic 13px "Newsreader", Georgia, serif';
      ctx.textAlign = 'center';
      ctx.fillText('Fig. 1 — Rotary Web Press Cylinder & Continuous Reel', colX + colW / 2, colStartY + imgBoxH + 28);

      // Brief text
      ctx.textAlign = 'left';
      ctx.fillStyle = '#1f2024';
      ctx.font = '14px/1.55 "Newsreader", Georgia, serif';
      const col2Lines = [
        'Cylinder web rolls unspool under continuous',
        'tension to prevent slack in the paper ribbon.',
        'Registered marks guarantee exact alignment.'
      ];
      let lineY = colStartY + imgBoxH + 58;
      for (const line of col2Lines) {
        ctx.fillText(line, colX, lineY);
        lineY += 23;
      }

    } else {
      // Column 3: Docket of Registered Precedents
      ctx.fillStyle = '#101114';
      ctx.font = 'bold 17px "Playfair Display", serif';
      ctx.textAlign = 'left';
      ctx.fillText('RECORD OF CLEARANCES', colX, colStartY + 14);

      const rows = [
        { no: 'REG-882', status: 'UNOPPOSED', date: '1888' },
        { no: 'REG-914', status: 'AUTHENTICATED', date: '1894' },
        { no: 'REG-991', status: 'INSCRIBED', date: '1902' },
        { no: 'REG-104', status: 'CLEARED', date: '1911' },
        { no: 'REG-330', status: 'SANCTIONED', date: '1924' }
      ];

      let tY = colStartY + 44;
      ctx.font = '600 12px "JetBrains Mono", monospace';
      for (const r of rows) {
        ctx.fillStyle = 'rgba(16, 17, 20, 0.07)';
        ctx.fillRect(colX, tY - 14, colW, 23);
        ctx.fillStyle = '#111215';
        ctx.fillText(r.no, colX + 8, tY + 2);
        ctx.fillStyle = config.accentColor || '#8b0000';
        ctx.fillText(r.status, colX + 84, tY + 2);
        ctx.fillStyle = '#555146';
        ctx.fillText(r.date, colX + colW - 40, tY + 2);
        tY += 28;
      }

      ctx.fillStyle = '#1f2024';
      ctx.font = '14px/1.55 "Newsreader", Georgia, serif';
      ctx.fillText('All titles certified under the sovereign charter of periodical publication.', colX, tY + 18);

      // Official Stamp Frame
      ctx.strokeStyle = 'rgba(16, 17, 20, 0.4)';
      ctx.strokeRect(colX, colStartY + colH - 95, colW, 80);
      ctx.font = 'bold 11px "Cinzel", Georgia, serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#101114';
      ctx.fillText('OFFICIAL REGISTRY SEAL', colX + colW / 2, colStartY + colH - 70);
      ctx.font = 'italic 12px "Newsreader", Georgia, serif';
      ctx.fillStyle = '#4c473e';
      ctx.fillText('Certified Genuine Newsprint Broadside', colX + colW / 2, colStartY + colH - 48);
      ctx.fillText('№ 84,209 / RGI-CH-1888', colX + colW / 2, colStartY + colH - 26);
    }
  }

  // Footer Rule
  ctx.strokeStyle = '#101114';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(pad - 16, y + h - 28);
  ctx.lineTo(w - pad + 16, y + h - 28);
  ctx.stroke();

  ctx.fillStyle = '#4c473e';
  ctx.font = '11px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillText(`— [ PAGE ${pageIndex + 1} OF CONTINUOUS WEB ROLL ] —`, w / 2, y + h - 12);
}

function drawWoodcutEngraving(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  theme: string
) {
  ctx.fillStyle = '#ebdcc5';
  ctx.fillRect(x, y, w, h);

  // Engraving hatch
  ctx.strokeStyle = 'rgba(16, 17, 20, 0.2)';
  ctx.lineWidth = 1;
  for (let i = 0; i < w + h; i += 6) {
    ctx.beginPath();
    ctx.moveTo(x + i, y);
    ctx.lineTo(x, y + i);
    ctx.stroke();
  }

  ctx.save();
  ctx.translate(x + w / 2, y + h / 2);
  ctx.strokeStyle = '#101114';
  ctx.fillStyle = '#101114';
  ctx.lineWidth = 2.5;

  ctx.beginPath();
  ctx.arc(0, 0, Math.min(w, h) * 0.4, 0, Math.PI * 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(0, 0, Math.min(w, h) * 0.36, 0, Math.PI * 2);
  ctx.stroke();

  if (theme === 'press') {
    ctx.strokeRect(-40, -24, 80, 48);
    ctx.strokeRect(-52, -10, 12, 20);
    ctx.strokeRect(40, -10, 12, 20);
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
      const gx = Math.cos(a) * 26;
      const gy = Math.sin(a) * 26;
      ctx.fillRect(gx - 3.5, gy - 3.5, 7, 7);
    }
  } else if (theme === 'seal') {
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      const r1 = 34;
      const r2 = 16;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * r1, Math.sin(a) * r1);
      ctx.lineTo(Math.cos(a + Math.PI / 8) * r2, Math.sin(a + Math.PI / 8) * r2);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(0, 0, 12, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.moveTo(-30, 30);
    ctx.lineTo(30, -30);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-24, -12);
    ctx.lineTo(0, -36);
    ctx.lineTo(24, -12);
    ctx.lineTo(0, 24);
    ctx.closePath();
    ctx.stroke();
  }

  ctx.restore();
}

function drawWoodcutSeal(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  color?: string
) {
  ctx.save();
  ctx.translate(cx, cy);

  ctx.strokeStyle = color || '#8b0000';
  ctx.fillStyle = color || '#8b0000';
  ctx.lineWidth = 2;

  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(0, 0, r - 6, 0, Math.PI * 2);
  ctx.stroke();

  for (let i = 0; i < 28; i++) {
    const a = (i * Math.PI * 2) / 28;
    const x1 = Math.cos(a) * (r - 2);
    const y1 = Math.sin(a) * (r - 2);
    const x2 = Math.cos(a) * (r + 4);
    const y2 = Math.sin(a) * (r + 4);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  ctx.font = 'bold 9.5px "Cinzel", serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('PRGI ARCHIVE', 0, -10);
  ctx.font = 'bold 8px "JetBrains Mono", monospace';
  ctx.fillText('★ 1888 ★', 0, 4);
  ctx.fillText('VERIFIED', 0, 16);

  ctx.restore();
}

/**
 * Generates the endcap circular spiral newsprint texture for the side of the 3D roll
 */
export function createRollEndcapTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.CanvasTexture(canvas);

  const cx = 256;
  const cy = 256;

  // Aged newsprint base
  ctx.fillStyle = '#e8d6b0';
  ctx.fillRect(0, 0, 512, 512);

  // Concentric tightly coiled paper layers
  for (let r = 240; r > 32; r -= 1.8) {
    const darkness = 0.1 + Math.random() * 0.15;
    ctx.strokeStyle = `rgba(28, 22, 16, ${darkness})`;
    ctx.lineWidth = 1.2 + (r % 10 === 0 ? 1.5 : 0);
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Radial paper grain lines
  ctx.strokeStyle = 'rgba(38, 28, 18, 0.08)';
  for (let a = 0; a < Math.PI * 2; a += Math.PI / 36) {
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * 38, cy + Math.sin(a) * 38);
    ctx.lineTo(cx + Math.cos(a) * 240, cy + Math.sin(a) * 240);
    ctx.stroke();
  }

  // Cardboard roll core cylinder ring
  ctx.strokeStyle = '#4a301d';
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.arc(cx, cy, 36, 0, Math.PI * 2);
  ctx.stroke();

  // Hollow center spindle
  ctx.fillStyle = '#0a0806';
  ctx.beginPath();
  ctx.arc(cx, cy, 31, 0, Math.PI * 2);
  ctx.fill();

  const texture = new THREE.CanvasTexture(canvas);
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  return texture;
}
