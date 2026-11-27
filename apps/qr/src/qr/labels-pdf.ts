import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';

export interface LabelSheet {
  coopNom: string;
  produitNom: string;
  lotNumero: string;
  datePeremption: string;
  /** e.g. https://agricoop.ma — labels encode `${verifyBaseUrl}/v/<token>`. */
  verifyBaseUrl: string;
  labels: { token: string; numeroSerie: number | null }[];
}

// A4 portrait, 3 × 8 labels with a 28 pt page margin (standard sticker sheets are close to this).
const PAGE = { width: 595.28, height: 841.89, margin: 28 };
const GRID = { cols: 3, rows: 8 };
const QR_SIZE = 78;

function frenchDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

/**
 * Printable sheet of QR labels. This PDF is the ONLY place where clear tokens exist: they are
 * rendered into the QR images and never stored, logged or returned otherwise.
 * Built-in PDF fonts cover French; Arabic labels would need an embedded font (out of MVP scope).
 */
export async function renderLabelSheet(sheet: LabelSheet): Promise<Buffer> {
  const doc = new PDFDocument({
    size: 'A4',
    margin: 0,
    info: {
      Title: `Étiquettes QR — lot ${sheet.lotNumero}`,
      Author: sheet.coopNom,
      Creator: 'AgriCoop',
    },
  });
  const chunks: Buffer[] = [];
  doc.on('data', (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  const cellW = (PAGE.width - 2 * PAGE.margin) / GRID.cols;
  const cellH = (PAGE.height - 2 * PAGE.margin) / GRID.rows;
  const perPage = GRID.cols * GRID.rows;
  const base = sheet.verifyBaseUrl.replace(/\/+$/, '');

  for (let i = 0; i < sheet.labels.length; i++) {
    const label = sheet.labels[i]!;
    const slot = i % perPage;
    if (i > 0 && slot === 0) doc.addPage();
    const x = PAGE.margin + (slot % GRID.cols) * cellW;
    const y = PAGE.margin + Math.floor(slot / GRID.cols) * cellH;

    doc
      .save()
      .lineWidth(0.3)
      .dash(2, { space: 2 })
      .strokeColor('#c8c8c8')
      .rect(x, y, cellW, cellH)
      .stroke()
      .restore();

    const png = await QRCode.toBuffer(`${base}/v/${label.token}`, {
      type: 'png',
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 300,
    });
    const qrY = y + (cellH - QR_SIZE) / 2;
    doc.image(png, x + 6, qrY, { width: QR_SIZE, height: QR_SIZE });

    const tx = x + QR_SIZE + 12;
    const tw = cellW - QR_SIZE - 18;
    doc.fillColor('#1c1917').font('Helvetica-Bold').fontSize(7.5);
    doc.text(sheet.produitNom, tx, y + 10, { width: tw, height: 20, ellipsis: true });
    doc.font('Helvetica').fontSize(7);
    doc.text(`Lot ${sheet.lotNumero}`, tx, y + 32, { width: tw, lineBreak: false, ellipsis: true });
    if (label.numeroSerie !== null) {
      doc.text(`N° ${label.numeroSerie}`, tx, y + 42, { width: tw, lineBreak: false });
    }
    doc.text(`À utiliser avant le ${frenchDate(sheet.datePeremption)}`, tx, y + 52, {
      width: tw,
      height: 18,
    });
    doc.fontSize(6).fillColor('#57534e');
    doc.text(sheet.coopNom, tx, y + cellH - 26, { width: tw, lineBreak: false, ellipsis: true });
    doc.text('Scannez pour vérifier l’authenticité', tx, y + cellH - 17, {
      width: tw,
      lineBreak: false,
      ellipsis: true,
    });
  }

  doc.end();
  return done;
}
