// One operation per frame. Destroying the frame releases its client and sockets.
// AutoScript stays unmodified; no intermediate storage/retrieval servers are set.
window.PDFNativeBridge={sign({data,properties,keystore},success,failure){
 if(!['WINDOWS','APPLE'].includes(keystore)||typeof window.WebSocket!=='function')throw new Error('Unsupported desktop');
 const api=window.AutoScript;
 window.SupportDialog?.enableSupportDialog(false);
 api.setForceWSMode(false);
 api.setStickySignatory(false);
 api.setAppName('PDF');
 api.setMinimumClientVersion('1.9');
 api.cargarAppAfirma(undefined,keystore);
 api.sign(data,'SHA256withRSA','PAdES',properties,signature=>success(signature),failure);
}};
