import { mkdirSync, createWriteStream } from 'node:fs';
import { join, resolve } from 'node:path';
import PDFDocument from 'pdfkit';
import { config } from './config.js';
import { findCase } from './cases.js';

mkdirSync(config.contractsDir, { recursive: true });

const formatBRL = (n) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(n) || 0);

const todayBR = () =>
  new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long' }).format(new Date());

function feeClauseText(lead) {
  const c = findCase(lead.case_type);
  const feeModel = c?.feeModel || lead.payment_terms || 'a combinar';
  const hasFixedAmount = Number(lead.fee_amount) > 0;

  const intro = `Pelos serviços prestados, o CONTRATANTE remunerará o CONTRATADO conforme o seguinte modelo: ${feeModel}.`;
  const valor = hasFixedAmount
    ? ` Valor de referência: ${formatBRL(lead.fee_amount)}.`
    : '';
  const pix = config.lawyer.pixKey
    ? ` Chave PIX para pagamentos: ${config.lawyer.pixKey}.`
    : '';

  return intro + valor + pix;
}

export async function buildContractPdf(lead) {
  const fileName = `contrato_${lead.phone}_${Date.now()}.pdf`;
  const filePath = resolve(join(config.contractsDir, fileName));
  const c = findCase(lead.case_type);
  const objeto = c?.scope || lead.scope || lead.case_summary ||
    'Consultoria e patrocínio da causa descrita pelo CONTRATANTE.';

  await new Promise((res, rej) => {
    const doc = new PDFDocument({ size: 'A4', margin: 56 });
    const out = createWriteStream(filePath);
    doc.pipe(out);

    doc.fontSize(16).font('Helvetica-Bold')
      .text('CONTRATO DE PRESTAÇÃO DE SERVIÇOS ADVOCATÍCIOS', { align: 'center' });
    doc.moveDown(1.5);

    doc.fontSize(11).font('Helvetica');

    section(doc, 'CONTRATANTE', [
      ['Nome', lead.client_name || '(a confirmar pelo cliente)'],
      ['Telefone', lead.phone]
    ]);

    section(doc, 'CONTRATADO', [
      ['Nome / Razão Social', config.lawyer.name],
      ['OAB', config.lawyer.oab || '—'],
      ['CPF/CNPJ', config.lawyer.document || '—'],
      ['Endereço', config.lawyer.address || '—'],
      ['E-mail', config.lawyer.email || '—']
    ]);

    if (lead.case_type && c?.label) {
      section(doc, 'ÁREA DE ATUAÇÃO', [
        ['Modalidade', c.label]
      ]);
    }

    clause(doc, 'CLÁUSULA 1ª — DO OBJETO',
      `O CONTRATADO prestará serviços advocatícios ao CONTRATANTE, compreendendo: ${objeto}`
    );

    clause(doc, 'CLÁUSULA 2ª — DOS HONORÁRIOS', feeClauseText(lead));

    clause(doc, 'CLÁUSULA 3ª — DAS OBRIGAÇÕES',
      'O CONTRATADO se obriga a empregar diligência profissional na condução do caso, ' +
      'sem garantia de resultado, observando as normas da OAB. O CONTRATANTE se obriga a fornecer ' +
      'documentos e informações verídicas, bem como a honrar os honorários nas condições acima.'
    );

    clause(doc, 'CLÁUSULA 4ª — DO FORO',
      'Fica eleito o foro do domicílio do CONTRATANTE para dirimir quaisquer controvérsias deste contrato.'
    );

    doc.moveDown(2);
    doc.text(`${(config.lawyer.address || '').split(',')[0] || 'Local'}, ${todayBR()}.`, {
      align: 'right'
    });
    doc.moveDown(3);

    sigLine(doc, 'CONTRATANTE', lead.client_name || '');
    doc.moveDown(2);
    sigLine(doc, 'CONTRATADO',
      `${config.lawyer.name}${config.lawyer.oab ? ' — OAB ' + config.lawyer.oab : ''}`
    );

    doc.end();
    out.on('finish', res);
    out.on('error', rej);
  });

  return filePath;
}

function section(doc, title, rows) {
  doc.font('Helvetica-Bold').text(title);
  doc.font('Helvetica');
  for (const [label, value] of rows) {
    doc.text(`${label}: ${value}`);
  }
  doc.moveDown(0.8);
}

function clause(doc, title, body) {
  doc.font('Helvetica-Bold').text(title);
  doc.font('Helvetica').text(body, { align: 'justify' });
  doc.moveDown(0.8);
}

function sigLine(doc, label, name) {
  doc.text('______________________________________________');
  doc.text(`${label}${name ? ' — ' + name : ''}`);
}
