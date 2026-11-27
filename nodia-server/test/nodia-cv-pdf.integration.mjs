import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { mkdir, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { join } from 'node:path';
import { Worker } from 'node:worker_threads';
import PDFDocument from 'pdfkit';
import {
  CV_PDF_LIMITS,
  CV_PDF_TEMPLATES,
} from '../dist/nodia-cv/pdf/nodia-cv-pdf-contract.js';
import { renderCvPdfBytes } from '../dist/nodia-cv/pdf/nodia-cv-pdf-layout.js';
import { verifyCvPdf } from '../dist/nodia-cv/pdf/nodia-cv-pdf-read.js';
import {
  CV_PDF_RENDERER,
  NodiaCvPdfRenderer,
  runCvPdfWorker,
  snapshotCvPdfSource,
} from '../dist/nodia-cv/pdf/nodia-cv-pdf-renderer.service.js';
import { composeCvPdfDocument } from '../dist/nodia-cv/pdf/nodia-cv-pdf-source.js';

const output = process.env.NODIA_CV_TEST_PDF_OUTPUT;
if (output) await mkdir(output, { recursive: true });
const diagnostic = (code, status = 422) => ({
  message: `nodiaCv:${code}`,
  status,
});
const fakeDate = new Date('2026-01-12T10:00:00Z');
const longPath =
  'portfolio-proyectos-documentos-auditoría-'.repeat(13) + 'proyecto';
const ownerEmail = 'muestra@example.invalid';

const completedPeriod = {
  start_month: '2021-02',
  end_month: '2024-08',
  status: 'finished',
};
const partialPeriods = [
  completedPeriod,
  { start_month: '2021-02', status: 'current' },
  { start_month: '2021-02', status: 'unspecified' },
  { end_month: '2024-08', status: 'finished' },
  { status: 'finished' },
  { start_month: '2021-02', status: 'finished' },
  { status: 'current' },
  { status: 'unspecified' },
];
const expectedPeriods = {
  es: [
    ['02/2021 - 08/2024'],
    ['02/2021 - Actualidad'],
    ['Inicio: 02/2021'],
    ['Fin: 08/2024'],
    ['Estado: Finalizado'],
    ['Inicio: 02/2021', 'Estado: Finalizado'],
    ['Estado: Actualidad'],
    [],
  ],
  en: [
    ['02/2021 - 08/2024'],
    ['02/2021 - Present'],
    ['Start: 02/2021'],
    ['End: 08/2024'],
    ['Status: Finished'],
    ['Start: 02/2021', 'Status: Finished'],
    ['Status: Present'],
    [],
  ],
};

function source(language, count, contact, periods = []) {
  const fullName = language === 'es' ? 'María Núñez' : 'Sofía Peña';
  const title =
    language === 'es' ? 'Ingeniería de software' : 'Software engineer';
  const confirmation =
    language === 'es'
      ? 'Revisé <marcadores> y prototipos C++ & C# con el equipo.'
      : 'Reviewed <markers> and C++ & C# prototypes with the team.';
  const facts = [
    {
      id: 'e1',
      section: 'profile',
      groupId: 'p',
      field: 'professional_title',
      text: title,
    },
    {
      id: 'e2',
      section: 'profile',
      groupId: 'p',
      field: 'summary',
      text: 'Práctica y revisión técnica de interfaces',
    },
    {
      id: 'e3',
      section: 'profile',
      groupId: 'p',
      field: 'main_stack',
      text: 'C++',
    },
    {
      id: 'e4',
      section: 'profile',
      groupId: 'p',
      field: 'main_stack',
      text: 'C#',
    },
  ];
  if (count > 1) {
    facts.push({
      id: 'e5',
      section: 'skills',
      groupId: 's',
      field: 'skills',
      text: 'PostgreSQL',
    });
  }
  for (let index = 1; index <= count; index++) {
    const role =
      language === 'es' ? 'Desarrollo de software' : 'Software development';
    const highlight =
      language === 'es'
        ? 'Diseñé pruebas de regresión y revisé componentes con el equipo de operaciones. Preparé una guía de recuperación, incluyendo diagnóstico, métricas y revisión técnica.'
        : 'Designed regression tests and reviewed components with operations. Prepared a recovery guide, including observability metrics and a technical review.';
    const roles = [
      ['company', `Equipo Ñ ${index}`],
      ['position', `${role} ${index}`],
      ...Object.entries(periods[index - 1] ?? completedPeriod),
      ['highlights', highlight],
      ['highlights', confirmation],
    ];
    for (const [field, text] of roles) {
      facts.push({
        id: `e${facts.length + 1}`,
        section: 'experience',
        groupId: `job${index}`,
        field,
        text,
      });
    }
  }
  return {
    language,
    profile: {
      id: randomUUID(),
      revision: 1,
      schema_version: 1,
      created_at: fakeDate,
      updated_at: fakeDate,
      profile_name: 'Etiqueta privada de perfil sintético',
      full_name: fullName,
      professional_title: title,
      contact,
      main_stack: ['C++', 'C#', 'DESCARTADO_PERFIL'],
      experiences: [],
      projects: [],
      skill_areas: [],
      education: [],
      certifications: [],
      languages: [],
      additional_sections: [],
    },
    draft: {
      locale: language,
      schemaVersion: 1,
      requirements: [
        {
          id: 'r1',
          quote: 'TEXTO_OFERTA_PRIVADA',
          kind: 'required',
          coverage: 'confirm',
          evidenceIds: [],
        },
      ],
      selectedFacts: facts.slice(0, 4),
      remainingFacts: [
        ...facts.slice(4),
        {
          id: 'e999',
          section: 'additional',
          groupId: 'x',
          field: 'lines',
          text: 'DATO_NO_INCLUIDO',
        },
      ],
    },
    review: {
      included_fact_ids: facts.map(({ id }) => id),
      evidence: [
        {
          requirement_id: 'r1',
          source: 'Confirmación técnica',
          detail: confirmation,
        },
      ],
    },
  };
}

async function fixturePdf(options, write) {
  const doc = new PDFDocument(options);
  const buffers = [];
  doc.on('data', (chunk) => buffers.push(chunk));
  const finished = once(doc, 'end');
  write(doc);
  doc.end();
  await finished;
  return Buffer.concat(buffers);
}

const renderer = new NodiaCvPdfRenderer();
let connectionCount = 0;
const loopback = createServer((_request, response) =>
  response.end('synthetic'),
);
loopback.on('connection', () => connectionCount++);
loopback.listen(0, '127.0.0.1');
await once(loopback, 'listening');
const localUrl = `http://127.0.0.1:${loopback.address().port}/${longPath}`;
const resultMatrix = [];
try {
  const esShort = source('es', 1, {
    location: 'Santiago, Chile',
    email: ownerEmail,
    linkedin_url: localUrl,
  });
  const filtered = snapshotCvPdfSource(esShort);
  assert.deepEqual(
    filtered.facts.map(({ id }) => id),
    esShort.review.included_fact_ids,
  );
  assert.equal(filtered.profile.full_name, 'María Núñez');
  assert.equal(
    filtered.facts.find(({ text }) => text === 'C++')?.section,
    'profile',
  );
  assert.equal('profile_name' in filtered.profile, false);
  assert.equal('draft' in filtered, false);

  const fixtures = [
    ['es-corto', esShort],
    ['en-corto', source('en', 1, { location: 'Santiago, Chile' })],
    [
      'es-largo',
      source('es', 9, {
        email: ownerEmail,
        phone: '+56 9 5555 0101',
        portfolio_url: `https://example.invalid/${longPath}`,
      }),
    ],
    [
      'en-largo',
      source('en', 9, {
        email: ownerEmail,
        github_url: 'https://example.invalid/sample?a=1&b=2',
      }),
    ],
  ];
  const firstStart = performance.now();
  const active = renderer.render(esShort, 'classic');
  await assert.rejects(
    renderer.render(esShort, 'compact'),
    diagnostic('pdf_busy', 429),
  );
  const classicShort = await active;
  const firstElapsed = Math.round(performance.now() - firstStart);
  const classicText = new Map();
  for (const template of CV_PDF_TEMPLATES) {
    for (const [name, fixture] of fixtures) {
      const started = performance.now();
      const result =
        template === 'classic' && fixture === esShort
          ? classicShort
          : await renderer.render(fixture, template);
      const renderedMs =
        result === classicShort
          ? firstElapsed
          : Math.round(performance.now() - started);
      const { bytes, sha256, page_count, extracted_text } = result;
      assert.equal(result.renderer, CV_PDF_RENDERER);
      assert.equal(bytes.subarray(0, 5).toString(), '%PDF-');
      assert.ok(bytes.length <= CV_PDF_LIMITS.bytes);
      assert.equal(createHash('sha256').update(bytes).digest('hex'), sha256);
      assert.equal(page_count === 1, name.endsWith('corto'));
      assert.equal(result.missing_contact, name === 'en-corto');
      if (template === 'classic') classicText.set(name, extracted_text);
      else assert.equal(extracted_text, classicText.get(name));
      assert.ok(extracted_text.startsWith(fixture.profile.full_name));
      const skills = fixture.language === 'es' ? 'Competencias' : 'Skills';
      const experience =
        fixture.language === 'es'
          ? 'Experiencia profesional'
          : 'Professional experience';
      const [preceding, technical] = extracted_text.split(`\n${skills}\n`);
      assert.ok(preceding.includes(`\n${experience}\n`));
      assert.doesNotMatch(preceding, /^C(?:\+\+|#)$/m);
      assert.ok(technical.startsWith('C++\nC#\n'));
      assert.equal(
        technical.includes('\nPostgreSQL\n'),
        name.endsWith('largo'),
      );
      const position =
        fixture.language === 'es'
          ? 'Desarrollo de software'
          : 'Software development';
      assert.ok(
        extracted_text.includes(
          `Equipo Ñ 1\n${position} 1\n02/2021 - 08/2024\n`,
        ),
      );
      assert.doesNotMatch(
        extracted_text,
        /2021-02|2024-08|Finished|Finalizado/,
      );
      assert.match(extracted_text, /<marcadores>|<markers>/);
      assert.ok(extracted_text.includes(fixture.review.evidence[0].detail));
      assert.doesNotMatch(
        extracted_text,
        /DESCARTADO_PERFIL|TEXTO_OFERTA_PRIVADA|DATO_NO_INCLUIDO|Etiqueta privada/,
      );
      if (fixture.profile.contact.linkedin_url)
        assert.ok(
          extracted_text.includes(fixture.profile.contact.linkedin_url),
        );
      if (fixture.profile.contact.portfolio_url)
        assert.ok(
          extracted_text.includes(fixture.profile.contact.portfolio_url),
        );
      if (fixture.profile.contact.email)
        assert.ok(extracted_text.includes(ownerEmail));
      if (output)
        await writeFile(join(output, `${template}-${name}.pdf`), bytes);
      resultMatrix.push({
        template,
        name,
        page_count,
        bytes: bytes.length,
        sha256,
        renderedMs,
      });
    }
  }

  for (const language of ['es', 'en']) {
    const periods = source(language, partialPeriods.length, {}, partialPeriods);
    const document = composeCvPdfDocument(snapshotCvPdfSource(periods));
    const position =
      language === 'es' ? 'Desarrollo de software' : 'Software development';
    for (const template of CV_PDF_TEMPLATES) {
      const { bytes, layout } = await renderCvPdfBytes(document, template);
      const confirmed = await verifyCvPdf(bytes, document, layout);
      const lines = confirmed.extracted_text.split('\n');
      const pages = layout.pages.map((page) =>
        page.map(({ text }) => text).join('\n'),
      );
      for (const [index, dates] of expectedPeriods[language].entries()) {
        const role = index + 1;
        const chronology = [
          `Equipo Ñ ${role}`,
          `${position} ${role}`,
          ...dates,
        ];
        const start = lines.indexOf(chronology[0]);
        assert.ok(start >= 0);
        assert.deepEqual(
          lines.slice(start, start + chronology.length),
          chronology,
        );
        assert.match(lines[start + chronology.length], /^(Diseñé|Designed)/);
        assert.ok(pages.some((page) => page.includes(chronology.join('\n'))));
      }
      if (output)
        await writeFile(
          join(output, `${template}-${language}-partial-periods.pdf`),
          bytes,
        );
    }
  }

  const document = composeCvPdfDocument(filtered);
  const layout = (await renderCvPdfBytes(document, 'classic')).layout;
  const editorial = (await renderCvPdfBytes(document, 'editorial')).layout;
  const modern = (await renderCvPdfBytes(document, 'contemporary')).layout;
  assert.equal(editorial.pages[0][0].style.font, 'SerifBold');
  assert.ok(editorial.pages[0].some(({ marker }) => marker === 'rule'));
  assert.ok(modern.pages[0][0].left > modern.margin);
  assert.ok(modern.pages[0].some(({ marker }) => marker === 'bar'));
  for (const variant of [editorial, modern]) {
    const bodyLines = variant.pages
      .flat()
      .filter(({ block }) =>
        ['section', 'group', 'body'].includes(document.blocks[block].kind),
      );
    assert.ok(bodyLines.every(({ left }) => left === variant.margin));
  }
  await assert.rejects(
    verifyCvPdf(Buffer.from('%PDF-1.7\nbroken'), document, layout),
    { code: 'pdf_read_failed' },
  );
  await assert.rejects(
    verifyCvPdf(Buffer.alloc(CV_PDF_LIMITS.bytes + 1), document, layout),
    { code: 'pdf_limits' },
  );

  const raster = await fixturePdf({ size: 'A4' }, (doc) =>
    doc.image(
      Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAAEElEQVR4nGNwCk2DIwbiOACZIw/R1M813AAAAABJRU5ErkJggg==',
        'base64',
      ),
      60,
      60,
      { width: 300 },
    ),
  );
  await assert.rejects(verifyCvPdf(raster, document, layout), {
    code: 'pdf_no_text',
  });

  const wrongPaper = await fixturePdf({ size: 'Letter' }, (doc) =>
    doc.text('Other layout'),
  );
  await assert.rejects(verifyCvPdf(wrongPaper, document, layout), {
    code: 'pdf_layout_invalid',
  });
  const fivePages = await fixturePdf({ size: 'A4' }, (doc) => {
    for (let page = 1; page <= CV_PDF_LIMITS.pages; page++) doc.addPage();
  });
  await assert.rejects(verifyCvPdf(fivePages, document, layout), {
    code: 'pdf_limits',
  });

  const changedDocument = {
    ...document,
    blocks: document.blocks.map((block, index) =>
      index === 0 ? { ...block, text: 'Campo presente cambiado' } : block,
    ),
  };
  await assert.rejects(
    verifyCvPdf(classicShort.bytes, changedDocument, layout),
    { code: 'pdf_text_mismatch' },
  );

  const unsupported = source('es', 1, {});
  unsupported.profile.full_name = 'Muestra \u{100000}';
  await assert.rejects(
    renderer.render(unsupported, 'classic'),
    diagnostic('pdf_text_mismatch'),
  );
  const tooMuchText = source('es', 1, {});
  tooMuchText.draft.selectedFacts[1].text = 'x'.repeat(
    CV_PDF_LIMITS.textUnits + 1,
  );
  await assert.rejects(
    renderer.render(tooMuchText, 'classic'),
    diagnostic('pdf_limits'),
  );
  await assert.rejects(
    renderer.render(source('es', 32, {}), 'classic'),
    diagnostic('pdf_limits'),
  );

  const worker = new Worker('while (true) {}', { eval: true });
  const exit = once(worker, 'exit');
  await assert.rejects(runCvPdfWorker(worker, 150), { code: 'pdf_timeout' });
  assert.equal(worker.threadId, -1);
  assert.deepEqual(await exit, [1]);
  assert.equal(connectionCount, 0);

  const stopping = renderer.render(esShort, 'classic');
  const cancelled = assert.rejects(
    stopping,
    diagnostic('pdf_render_failed', 500),
  );
  await renderer.onModuleDestroy();
  await cancelled;
  await assert.rejects(
    renderer.render(esShort, 'classic'),
    diagnostic('pdf_busy', 429),
  );
  console.log(
    JSON.stringify({
      platform: process.platform,
      node: process.version,
      renderer: CV_PDF_RENDERER,
      files: resultMatrix,
    }),
  );
} finally {
  await renderer.onModuleDestroy();
  await new Promise((resolve, reject) =>
    loopback.close((error) => (error ? reject(error) : resolve())),
  );
}
