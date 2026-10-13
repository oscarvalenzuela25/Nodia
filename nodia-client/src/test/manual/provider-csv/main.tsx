// Isolated synthetic QA: all HTTP is intercepted, in a separate localhost origin.
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { Box } from '@mui/material';
import 'sileo/styles.css';
import '../../../styles/main.css';
import MUIProvider from '../../../providers/MUIProvider';
import auth from '../../../store/authStore';
import config from '../../../store/configStore';
import i18n from '../../../translate';
import { mainInstance } from '../../../config/api';
import ProvidersTab from '../../../modules/business/pages/BusinessDetail/components/ProvidersTab/ProvidersTab';
import ProviderContacts from '../../../modules/business/pages/BusinessDetail/components/ProvidersTab/components/ProviderContacts';
const params = new URLSearchParams(location.search);
await i18n.changeLanguage(params.get('lang') === 'en' ? 'en' : 'es');
config.setState({ themeType: params.get('theme') === 'light' ? 'light' : 'dark' });
auth.getState().login({ token:'synthetic-never-sent',expiresAt:Date.now()+900000,user:{id:'provider-csv-qa',name:'QA'} });
const business = '11111111-1111-4111-8111-111111111111';
let failed = false;
mainInstance.defaults.adapter = async (request) => {
  await new Promise<void>((resolve) => setTimeout(resolve,350));
  const response = (data: unknown,status=200) => ({ config:request,data,status,statusText:'QA',headers:{} });
  if (request.url?.endsWith('/contacts')) {
    const contact = { id:'1',provider_id:'9007199254740993',name:'María QA',phone:[{number:'+56987654321'}],email:null,description:null,schedule:{},is_active:true,version:1,created_at:'2026-10-11T12:00:00Z',updated_at:'2026-10-11T12:00:00Z' };
    const data = contact.name.toLowerCase().includes(String(request.params?.search ?? '').toLowerCase()) ? [contact] : [];
    return response({data,meta:{page:1,limit:25,total_items:data.length,total_pages:data.length ? 1 : 0}});
  }
  if (request.url?.endsWith('/providers/import')) {
    if (!failed) { failed = true; throw new AxiosError('Synthetic failure','ERR_BAD_RESPONSE',request,undefined,response({message:'Error sintético para verificar reintento'},503)); }
    return response({providers:1,contacts:2},201);
  }
  if (request.url?.endsWith('/providers/export-csv')) return response('name,tax,is_active,id,contacts,csv_version\nProveedor QA,0,false,9007199254740993,"[{""id"":""1"",""version"":1,""name"":""María QA""},{""name"":""Pedro QA""}]",2');
  if (request.url?.endsWith('/providers')) return response({data:[{id:'9007199254740993',business_id:business,name:'Proveedor QA con nombre largo y datos personales',tax:0,is_active:true,fields:{code:'SKU'},created_at:'2026-10-11T12:00:00Z'}],meta:{page:1,limit:50,total_items:1,total_pages:1}});
  throw new Error(`Unexpected synthetic request: ${request.url}`);
};
const client = new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}});
createRoot(document.getElementById('root')!).render(<QueryClientProvider client={client}><MUIProvider><Box sx={{p:{xs:2,sm:3,md:4}}}>{params.get('view') === 'contacts' ? <ProviderContacts providerId="9007199254740993" providerName="Proveedor QA" onBack={()=>history.back()}/> : <ProvidersTab businessId={business}/>}</Box></MUIProvider></QueryClientProvider>);
