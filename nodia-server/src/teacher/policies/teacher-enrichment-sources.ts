import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { Worker } from 'node:worker_threads';
import { object, text, teacherError } from './teacher-validation.js';
import type {
  PreparedSource,
  SourcePage,
} from '../types/teacher-enrichment.types.js';

let converting = false;
const pdfWorker = `
const {parentPort,workerData}=require('node:worker_threads');
(async()=>{
 const {getDocument}=await import(workerData.moduleUrl);
 const task=getDocument({data:new Uint8Array(workerData.bytes),isEvalSupported:false,useSystemFonts:false,disableFontFace:true,stopAtErrors:true,verbosity:0});
 let doc,result;
 try {
  doc=await task.promise;
  if(doc.numPages>12)throw Error('limit');
  const pages=[];let length=0,bytes=0;const notices=[];
  for(let page=1;page<=doc.numPages;page++){
   const p=await doc.getPage(page);const content=await p.getTextContent();
   const text=content.items.filter(x=>'str' in x).map(x=>x.str+(x.hasEOL?'\\n':' ')).join('').trim();
   length+=text.length;bytes+=Buffer.byteLength(text);
   if(length>32000||bytes>131072)throw Error('limit');
   if(!text)notices.push('teacher:source_page_without_text');
   pages.push({page,text});p.cleanup();
  }
  if(!pages.some(p=>p.text))throw Error('no_text');
  result={ok:true,pages,notices:[...new Set(notices)]};
 }catch(e){result={ok:false,code:e.message==='limit'?'source_limit_exceeded':e.message==='no_text'?'source_no_text':'invalid_source'};}
 finally{try{if(doc)await doc.destroy();else await task.destroy();}catch{if(!result)result={ok:false,code:'invalid_source'};}}
 parentPort.postMessage(result);
})().catch(()=>parentPort.postMessage({ok:false,code:'invalid_source'}));
`;
async function extractPdf(
  bytes: Uint8Array,
): Promise<{ pages: SourcePage[]; notices: string[] }> {
  if (converting) teacherError('capacity_unavailable', 429);
  converting = true;
  let worker: Worker | undefined;
  try {
    const moduleUrl = pathToFileURL(
      createRequire(import.meta.url).resolve('pdfjs-dist/legacy/build/pdf.mjs'),
    ).href;
    worker = new Worker(pdfWorker, {
      eval: true,
      workerData: { bytes, moduleUrl },
      resourceLimits: {
        maxOldGenerationSizeMb: 96,
        maxYoungGenerationSizeMb: 16,
        stackSizeMb: 2,
      },
    });
    return await new Promise<{ pages: SourcePage[]; notices: string[] }>(
      (resolve, reject) => {
        const timeout = setTimeout(
          () => reject(new Error('source_processing_timeout')),
          5000,
        );
        const fail = (code: string) => {
          clearTimeout(timeout);
          reject(new Error(code));
        };
        worker!.once('error', () => fail('invalid_source'));
        worker!.once('exit', (code) => {
          if (code !== 0) fail('invalid_source');
        });
        worker!.once(
          'message',
          (message: {
            ok?: boolean;
            pages?: SourcePage[];
            notices?: string[];
            code?: string;
          }) => {
            clearTimeout(timeout);
            if (!message.ok || !Array.isArray(message.pages))
              return reject(new Error(message.code ?? 'invalid_source'));
            resolve({ pages: message.pages, notices: message.notices ?? [] });
          },
        );
      },
    );
  } catch (error) {
    const message = error !== null && typeof error === 'object' && 'message' in error
      && typeof error.message === 'string' ? error.message : null;
    const code =
      message !== null &&
      [
        'source_processing_timeout',
        'source_limit_exceeded',
        'source_no_text',
      ].includes(message)
        ? message
        : 'invalid_source';
    return teacherError(code, 422);
  } finally {
    if (worker) await worker.terminate();
    converting = false;
  }
}
/** Conversion runs outside the command transaction and is authorized again on save. */
export async function prepareSource(value: unknown): Promise<PreparedSource> {
  const v = object(value, ['title', 'media_type', 'text', 'base64']);
  const title = text(v.title, 1, 160);
  let pages: SourcePage[];
  let notices: string[] = [];
  if (v.media_type === 'text/plain') {
    if (v.base64 !== undefined) teacherError('invalid_input', 400);
    const content = text(v.text, 1, 32000, false);
    if (Buffer.byteLength(content) > 131072)
      teacherError('source_limit_exceeded', 413);
    pages = [{ page: 1, text: content }];
  } else if (v.media_type === 'application/pdf') {
    if (v.text !== undefined) teacherError('invalid_input', 400);
    const encoded = text(v.base64, 8, 131072, false);
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded) || encoded.length % 4 !== 0)
      teacherError('invalid_source', 400);
    const bytes = Buffer.from(encoded, 'base64');
    if (
      bytes.length > 98304 ||
      bytes.toString('base64') !== encoded ||
      bytes.subarray(0, 5).toString('ascii') !== '%PDF-'
    )
      teacherError('invalid_source', 400);
    ({ pages, notices } = await extractPdf(bytes));
  } else teacherError('invalid_input', 400);
  const content_hash = createHash('sha256')
    .update(JSON.stringify(pages))
    .digest('hex');
  return { title, media_type: v.media_type, pages, notices, content_hash };
}
