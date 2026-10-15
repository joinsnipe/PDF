import test from 'node:test';
import assert from 'node:assert/strict';
import {PDFDocument,PDFName,PDFHexString} from '../dist/vendor/pdf-lib.js';
import {signatureInfo,assertCanSign,assertCanEdit} from '../dist/signature-policy.js';
async function doc(){const d=await PDFDocument.create();d.addPage();return d;}
function signature(d,p){const ref=d.context.register(d.context.obj({Type:'Sig',ByteRange:[0,10,20,30],Contents:PDFHexString.of('1234'),Reference:p?[{Type:'SigRef',TransformMethod:'DocMDP',TransformParams:{P:p}}]:[]}));if(p)d.catalog.set(PDFName.of('Perms'),d.context.obj({DocMDP:ref}));return ref;}
test('inspección no confunde un campo vacío con una firma',async()=>{
 const d=await doc();d.context.register(d.context.obj({FT:'Sig',T:PDFHexString.fromText('Pendiente')}));
 assert.equal(signatureInfo(d).signed,false);assert.doesNotThrow(()=>assertCanSign(signatureInfo(d),'final'));assert.doesNotThrow(()=>assertCanEdit(signatureInfo(d)));
});
test('DocMDP 1 bloquea cofirma; niveles 2 y 3 permiten cofirmar pero no editar en esta app',async()=>{
 for(const p of [1,2,3]){const d=await doc();signature(d,p);const info=signatureInfo(d);assert.equal(info.count,1);assert.equal(info.certification,p);assert.equal(info.locked,p===1);assert.throws(()=>assertCanEdit(info),{code:'PDF_SIGNED_DOCUMENT'});if(p===1)assert.throws(()=>assertCanSign(info),{code:'PDF_SIGNATURE_LOCKED'});else assert.doesNotThrow(()=>assertCanSign(info));}
});
test('restricciones incompletas o de campos se rechazan de forma conservadora',async()=>{
 const malformed=await doc();signature(malformed,9);assert.equal(signatureInfo(malformed).locked,true);
 const field=await doc();signature(field);field.context.register(field.context.obj({TransformMethod:'FieldMDP',TransformParams:{Action:'All'}}));assert.equal(signatureInfo(field).locked,true);
 const missing=await doc();missing.catalog.set(PDFName.of('Perms'),missing.context.obj({DocMDP:missing.context.obj({})}));assert.equal(signatureInfo(missing).locked,true);assert.equal(signatureInfo(missing).signed,true);
});
