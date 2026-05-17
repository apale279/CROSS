#!/usr/bin/env node
/**
 * Genera GUIDA.pdf da GUIDA.md (Markdown → PDF).
 *
 * Uso:
 *   npm run generate:guida-pdf
 *   node scripts/generate-guida-pdf.mjs [percorso-output.pdf]
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mdToPdf } from 'md-to-pdf';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const mdPath = join(ROOT, 'GUIDA.md');
const outPath = process.argv[2] ? join(process.cwd(), process.argv[2]) : join(ROOT, 'GUIDA.pdf');

if (!existsSync(mdPath)) {
  console.error('File non trovato:', mdPath);
  process.exit(1);
}

const css = `
  @page {
    margin: 18mm 16mm 20mm 16mm;
  }
  body {
    font-family: 'Segoe UI', system-ui, sans-serif;
    font-size: 10.5pt;
    line-height: 1.45;
    color: #1e293b;
  }
  h1 {
    font-size: 20pt;
    color: #0c4a6e;
    border-bottom: 2px solid #0284c7;
    padding-bottom: 6px;
    margin-top: 0;
  }
  h2 {
    font-size: 14pt;
    color: #0369a1;
    margin-top: 1.4em;
    page-break-after: avoid;
  }
  h3 {
    font-size: 11.5pt;
    color: #334155;
    margin-top: 1em;
    page-break-after: avoid;
  }
  table {
    border-collapse: collapse;
    width: 100%;
    font-size: 9.5pt;
    margin: 0.8em 0;
  }
  th, td {
    border: 1px solid #cbd5e1;
    padding: 5px 8px;
    text-align: left;
    vertical-align: top;
  }
  th {
    background: #f1f5f9;
    font-weight: 700;
  }
  code {
    background: #f1f5f9;
    padding: 1px 4px;
    border-radius: 3px;
    font-size: 9pt;
  }
  pre code {
    display: block;
    padding: 8px;
    white-space: pre-wrap;
  }
  blockquote {
    border-left: 3px solid #0284c7;
    margin: 0.8em 0;
    padding: 0.2em 0 0.2em 12px;
    color: #475569;
  }
  hr {
    border: none;
    border-top: 1px solid #e2e8f0;
    margin: 1.5em 0;
  }
  a {
    color: #0369a1;
    text-decoration: none;
  }
  ul, ol {
    padding-left: 1.4em;
  }
  li {
    margin: 0.2em 0;
  }
`;

console.log('Generazione PDF da', mdPath);
const pdf = await mdToPdf(
  { path: mdPath },
  {
    dest: outPath,
    css,
    pdf_options: {
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
    },
    launch_options: {
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    },
  },
);

if (!pdf?.filename) {
  console.error('Generazione PDF fallita');
  process.exit(1);
}

console.log('OK — PDF scritto in:', pdf.filename);
