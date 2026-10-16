// Retired shared relay. Do not read request bodies, keys or documents.
export function handleAI(){
 return Response.json({available:false,code:'AI_UPDATE_REQUIRED',error:'Actualiza PDF Contigo a 2.4.0-beta.6 o posterior. La IA conecta desde tu dispositivo; el servidor compartido se ha retirado.'},{status:410,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
}
