// SYNTHETIC QA ONLY: isolated transport, no real server, account or database.
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { AxiosError } from 'axios';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Box, Button, Typography } from '@mui/material';
import '@fontsource/inter/400.css';
import '@fontsource/inter/600.css';
import '../../src/styles/main.css';
import MUIProvider from '../../src/providers/MUIProvider';
import useAuthStore from '../../src/store/authStore';
import config from '../../src/store/configStore';
import { mainInstance } from '../../src/config/api';
import i18n from '../../src/translate';
import ProductModal from '../../src/modules/business/pages/BusinessDetail/components/ProductsTab/components/ProductModal';
import type { ProductEntity } from '../../src/modules/business/infrastructure/types';
import type { ProductFormData } from '../../src/modules/business/pages/BusinessDetail/components/ProductsTab/components/ProductModal/ProductModal';
import type { ProductSaveTarget } from '../../src/modules/business/pages/BusinessDetail/components/ProductsTab/components/ProductModal/hooks/useDeferredProductSave';

const params = new URLSearchParams(location.search);
await i18n.changeLanguage(params.get('lang') === 'en' ? 'en' : 'es');
config.setState({ themeType: params.get('theme') === 'light' ? 'light' : 'dark' });
useAuthStore.getState().login({ token: 'synthetic-never-sent', expiresAt: Date.now()+900000, user: { id: 'synthetic-product-editor-qa', name: 'QA' } });
const imageUrl = 'data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="280"><rect width="400" height="280" rx="20" fill="#eff3ff"/><circle cx="200" cy="120" r="65" fill="#6f68ee"/><text x="200" y="235" text-anchor="middle" font-family="sans-serif" font-size="24" fill="#222">Imagen de prueba</text></svg>');
const original: ProductEntity = { id:'synthetic-product', business_id:'synthetic-business', code:'PROVEEDOR-FACTURA-REFERENCIA-LARGA-000012345678901234567890', name:'Producto de prueba para revisar la edición', barcode:'000123456789012345678901234567890', cost_price:1000, cost_price_tax:1190, profit_percentage:30, sale_price:1547, offer_price:null, is_offer_enabled:false, has_stock:true, is_active:true, version:3, stock:0 };
let product = {...original};
let hasImage = params.get('new') !== '1';
let attempt: Record<string, unknown> | null = null;
let failed = false;
const qa = { requests: [] as {method:string;url:string;payload:unknown}[], persisted: [] as ProductEntity[], closes:0 };
Object.assign(window,{__productEditorQa:qa});
mainInstance.defaults.adapter = async request => {
  const url = request.url ?? '';
  const method = String(request.method).toUpperCase();
  const payload = typeof request.data === 'string' ? JSON.parse(request.data) : request.data;
  qa.requests.push({method,url,payload:payload instanceof FormData ? '[File]' : payload});
  await new Promise(resolve=>setTimeout(resolve,80));
  const response = (data:unknown,status=200)=>({config:request,data,status,statusText:'Synthetic QA',headers:{}});
  if(method==='GET' && /\/products\/[^/]+\/image$/.test(url)) return response(hasImage?{url:imageUrl,id:'qa-image',product_version:product.version}:null);
  if(method==='GET' && /\/products\/[^/]+$/.test(url)) return response({...product,name:'Nombre guardado en otra sesión',code:original.code+'-ACTUALIZADO'});
  if((method==='POST' && url.endsWith('/products')) || (method==='PUT' && /\/products\/[^/]+$/.test(url))) {
    product={...product,...payload,id:'synthetic-product',business_id:'synthetic-business',version:method==='POST'?1:(product.version??0)+1};
    qa.persisted.push({...product}); return response({...product});
  }
  if(method==='POST' && url.endsWith('/product-image-uploads')) { attempt={id:payload.request_key,product_id:product.id,status:'pending',is_current:false,product_version:product.version}; return response(attempt); }
  if(method==='PUT' && url.endsWith('/content')) {
    attempt={...attempt,status:'ready'};
    if(params.get('fail')==='content' && !failed) {failed=true;throw new AxiosError('Synthetic lost upload response','ERR_NETWORK',request);}
    return response(attempt);
  }
  if(method==='GET' && url.includes('/product-image-uploads/')) return response(attempt);
  if(method==='POST' && url.endsWith('/complete')) { hasImage=true;product={...product,version:(product.version??0)+1};attempt={...attempt,status:'ready',is_current:true,product_version:product.version};return response(attempt); }
  if(method==='DELETE' && url.endsWith('/image')) { const removed=hasImage;hasImage=false;product={...product,version:(product.version??0)+(removed?1:0)};return response({removed,product_version:product.version}); }
  throw new Error('Unexpected synthetic request '+method+' '+url);
};
const client = new QueryClient({defaultOptions:{queries:{retry:false,refetchOnWindowFocus:false},mutations:{retry:false}}});
export function App() {
  const [open,setOpen]=useState(true);
  const persist = async(data:ProductFormData,target?:ProductSaveTarget) => (await (target?mainInstance.put<ProductEntity>('/products/'+target.id,{...data,expected_version:target.version}):mainInstance.post<ProductEntity>('/products',data))).data;
  return <Box sx={{p:2}}><Typography>Datos sintéticos: editor de productos</Typography><Button onClick={()=>setOpen(true)}>Abrir editor</Button><ProductModal businessId="synthetic-business" open={open} initialData={params.get('new')==='1'?null:original} onSubmit={persist} onClose={()=>{qa.closes++;setOpen(false)}} /></Box>;
}
createRoot(document.getElementById('root')!).render(<QueryClientProvider client={client}><MUIProvider><App/></MUIProvider></QueryClientProvider>);
