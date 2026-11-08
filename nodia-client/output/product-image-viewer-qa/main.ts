// SYNTHETIC ONLY: reuse the existing business UI fixture and intercept every request.
import '../../src/test/manual/business/main';
import { AxiosError, type AxiosAdapter } from 'axios';
import { mainInstance } from '../../src/config/api';
const original = mainInstance.defaults.adapter as AxiosAdapter;
const params = new URLSearchParams(location.search);
const versions = new Map<string,number>();
const attempts = new Map<string,Record<string,unknown>>();
const images = new Map<string,boolean>();
let failed = false;
const imageUrl='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="280"><rect width="400" height="280" fill="#f3f3ff"/><circle cx="200" cy="110" r="65" fill="#776ef5"/><text x="200" y="240" text-anchor="middle" font-size="24">Imagen sintética QA</text></svg>');
const qa={requests:[] as {method:string;url:string;payload:unknown}[]};
Object.assign(window,{__productImageViewerQa:qa});
mainInstance.defaults.adapter=async request=>{
 const url=request.url??'',method=String(request.method).toUpperCase();
 const payload=typeof request.data==='string'?JSON.parse(request.data):request.data;
 qa.requests.push({method,url,payload:payload instanceof FormData?'[File]':payload});
 const response=(data:unknown,status=200)=>({config:request,data,status,statusText:'Synthetic image viewer QA',headers:{}});
 const reject=(status:number,message:string):never=>{throw new AxiosError(message,'ERR_BAD_RESPONSE',request,undefined,response({message},status))};
 const imageId=/\/products\/([^/]+)\/image$/.exec(url)?.[1];
 if(imageId){
  await new Promise(resolve=>setTimeout(resolve,80));
  const exists=images.get(imageId)??params.get('noImage')!=='1';
  if(method==='GET')return response(exists?{id:'qa-image',url:imageUrl,product_version:versions.get(imageId)??1}:null);
  if(method==='DELETE'){images.set(imageId,false);const version=(versions.get(imageId)??1)+(exists?1:0);versions.set(imageId,version);return response({removed:exists,product_version:version})}
 }
 if(method==='POST'&&url.endsWith('/product-image-uploads')){const attempt={id:payload.request_key,product_id:payload.product_id,status:'pending',is_current:false,product_version:versions.get(payload.product_id)??1};attempts.set(String(attempt.id),attempt);return response(attempt)}
 const attemptId=/\/product-image-uploads\/([^/]+)(?:\/(content|complete))?$/.exec(url);
 if(attemptId){
  const attempt=attempts.get(attemptId[1]);if(!attempt)return reject(404,'product:image_not_found');
  if(method==='GET')return response({...attempt});
  if(method==='PUT'&&attemptId[2]==='content'){
   Object.assign(attempt,{status:'ready'});
   if(params.get('fail')==='content'&&!failed){failed=true;throw new AxiosError('Synthetic lost PUT response','ERR_NETWORK',request)}
   return response({...attempt});
  }
  if(method==='POST'&&attemptId[2]==='complete'){
   const id=String(attempt.product_id);
   if(params.get('fail')==='conflict'&&!failed){failed=true;versions.set(id,2);return reject(409,'product:version_conflict')}
   const version=(versions.get(id)??1)+1;versions.set(id,version);images.set(id,true);Object.assign(attempt,{is_current:true,product_version:version});return response({...attempt});
  }
 }
 if((method==='POST'&&url.endsWith('/products'))||(method==='PUT'&&/\/products\/[^/]+$/.test(url)))throw new Error('Image viewer must not mutate product fields');
 const result=await original(request);
 if(method==='GET'&&url.endsWith('/products')&&result.data?.data?.length){
  const first=result.data.data[0];
  if(!first.previous_price_snapshot)first.previous_price_snapshot={...first,id:'qa-previous-product-log',product_id:first.id,name:'Nombre anterior QA',sale_price:1400,created_at:'2026-10-08',updated_at:'2026-10-08'};
 }
 const id=/\/products\/([^/]+)$/.exec(url)?.[1];
 if(id&&method==='GET')return {...result,data:{...result.data,version:versions.get(id)??result.data.version}};
 return result;
};
