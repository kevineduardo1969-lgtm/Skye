import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.49.8';
import JSZip from 'npm:jszip@3.10.1';
import * as pdfjs from 'npm:pdfjs-dist@4.10.38/legacy/build/pdf.mjs';

const corsHeaders = {'Access-Control-Allow-Origin':'*', 'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type'};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {status, headers:{...corsHeaders, 'Content-Type':'application/json'}});
const textDecoder = new TextDecoder();
const allowedExtensions = new Set(['txt', 'csv', 'docx', 'pdf']);

function extensionOf(path: string) { return path.split('.').pop()?.toLowerCase() || ''; }
function cleanText(value: string) { return value.replace(/\s+/g, ' ').trim().slice(0, 12000); }
function decodeXml(value: string) { return value.replace(/<w:tab\/>/g, ' ').replace(/<\/w:p>/g, '\n').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>'); }

async function extractText(file: Uint8Array, extension: string) {
  if (extension === 'txt' || extension === 'csv') return cleanText(textDecoder.decode(file));
  if (extension === 'docx') {
    const zip = await JSZip.loadAsync(file);
    const documentXml = await zip.file('word/document.xml')?.async('text');
    if (!documentXml) throw new Error('No pudimos encontrar texto en el documento Word.');
    return cleanText(decodeXml(documentXml));
  }
  if (extension === 'pdf') {
    const document = await pdfjs.getDocument({data:file}).promise;
    let result = '';
    for (let pageNumber = 1; pageNumber <= Math.min(document.numPages, 20); pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      result += content.items.map((item: any) => item.str || '').join(' ') + '\n';
    }
    return cleanText(result);
  }
  throw new Error('El formato del archivo no se puede procesar.');
}

const proposalSchema = {
  type:'object', additionalProperties:false, required:['proposals'],
  properties:{
    proposals:{type:'array', minItems:1, maxItems:5, items:{type:'object', additionalProperties:false, required:['title','module_id','skill','difficulty','interaction_type','prompt','options','answer','hint','explanation','stars'], properties:{
      title:{type:'string'}, module_id:{type:'string', enum:['split','pattern','order','lab','robot','division','fractions','decimals','proportion','logic']}, skill:{type:'string'}, difficulty:{type:'string', enum:['inicio','práctica','desafío']}, interaction_type:{type:'string', enum:['multiple-choice','numeric','multi-select','order']}, prompt:{type:'string'}, options:{type:'array', items:{type:'string'}}, answer:{type:'array', items:{type:'string'}}, hint:{type:'string'}, explanation:{type:'string'}, stars:{type:'integer', minimum:1, maximum:10}
    }}}
  }
};

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', {headers:corsHeaders});
  if (request.method !== 'POST') return json({error:'Método no permitido.'}, 405);
  try {
    const authorization = request.headers.get('Authorization') || '';
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const openaiKey = (Deno.env.get('OPENAI_API_KEY') || '').trim();
    if (!supabaseUrl || !anonKey || !serviceKey) throw new Error('La función no tiene la configuración de Supabase necesaria.');
    if (!openaiKey) return json({error:'La generación con IA aún no está configurada. Pide a la administración del proyecto que agregue el secreto de IA en la Edge Function.'}, 503);
    const caller = createClient(supabaseUrl, anonKey, {global:{headers:{Authorization:authorization}}});
    const {data:{user}, error:authError} = await caller.auth.getUser();
    if (authError || !user) return json({error:'Tu sesión docente ya no está disponible. Inicia sesión de nuevo.'}, 401);
    const admin = createClient(supabaseUrl, serviceKey);
    const {data:profile, error:profileError} = await admin.from('profiles').select('id,role').eq('id', user.id).maybeSingle();
    if (profileError || profile?.role !== 'docente') return json({error:'Solo las cuentas docentes pueden generar borradores.'}, 403);
    const {path, sourceName} = await request.json();
    if (typeof path !== 'string' || !path.startsWith(`${user.id}/`)) return json({error:'El archivo no pertenece a tu espacio privado.'}, 403);
    const extension = extensionOf(path);
    if (!allowedExtensions.has(extension)) return json({error:'El formato del archivo no está permitido.'}, 400);
    const {data:file, error:downloadError} = await admin.storage.from('teacher-materials').download(path);
    if (downloadError || !file) return json({error:'No pudimos recuperar el archivo privado. Vuelve a subirlo e inténtalo.'}, 404);
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (bytes.byteLength > 5 * 1024 * 1024) return json({error:'El archivo supera el límite de 5 MB para procesarlo.'}, 400);
    let generationId = '';
    const {data:generation} = await admin.from('ai_challenge_generations').insert({teacher_id:user.id, source_path:path, source_name:typeof sourceName === 'string' ? sourceName.slice(0,180) : path.split('/').pop(), status:'processing'}).select('id').single();
    generationId = generation?.id || '';
    let material = '';
    try { material = await extractText(bytes, extension); }
    catch (error) { if (generationId) await admin.from('ai_challenge_generations').update({status:'error', completed_at:new Date().toISOString()}).eq('id', generationId); return json({error:error instanceof Error ? error.message : 'No pudimos leer este archivo.'}, 422); }
    if (material.length < 30) { if (generationId) await admin.from('ai_challenge_generations').update({status:'error', completed_at:new Date().toISOString()}).eq('id', generationId); return json({error:'El archivo tiene muy poco texto legible para crear borradores útiles.'}, 422); }
    const prompt = `Convierte el siguiente material didáctico en entre 1 y 5 BORRADORES editables de retos para quinto de primaria (10-11 años). Prioriza pensamiento computacional y lógico-matemático: descomposición, patrones, secuenciación, pensamiento algorítmico, análisis de datos, toma de decisiones, divisiones, fracciones, decimales o proporcionalidad. Usa español claro, amable y apropiado. No incluyas nombres, calificaciones, datos personales, contenido sensible ni programación avanzada. Para multiple-choice y multi-select, answer debe contener exactamente el texto de una o varias opciones. Para numeric, answer contiene una respuesta numérica. Para order, answer contiene los pasos en el orden correcto. No expliques que eres IA. Material:\n\n${material}`;
    const response = await fetch('https://api.openai.com/v1/responses', {method:'POST', headers:{'Authorization':`Bearer ${openaiKey}`, 'Content-Type':'application/json'}, body:JSON.stringify({model:Deno.env.get('OPENAI_MODEL') || 'gpt-4o-mini', store:false, input:[{role:'system', content:'Genera solamente propuestas educativas seguras y estructuradas.'},{role:'user', content:prompt}], text:{format:{type:'json_schema', name:'skye_challenge_drafts', strict:true, schema:proposalSchema}}})});
    if (!response.ok) throw new Error(`La IA no respondió correctamente (${response.status}).`);
    const result = await response.json();
    const parsed = JSON.parse(result.output_text || '{}');
    const proposals = Array.isArray(parsed.proposals) ? parsed.proposals.slice(0, 5) : [];
    if (!proposals.length) throw new Error('La IA no devolvió borradores revisables.');
    if (generationId) await admin.from('ai_challenge_generations').update({status:'completed', proposal_count:proposals.length, completed_at:new Date().toISOString()}).eq('id', generationId);
    return json({generationId, proposals});
  } catch (error) {
    console.error(error);
    return json({error:error instanceof Error ? error.message : 'No pudimos generar borradores en este momento.'}, 500);
  }
});
