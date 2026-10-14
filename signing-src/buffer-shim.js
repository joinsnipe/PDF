import { Buffer } from 'buffer';
// @signpdf uses Node's Buffer.subarray().toString() contract.
// Keep that contract explicit when bundling the browser Buffer polyfill.
Buffer.prototype.subarray = function(start,end) {
  const view=Uint8Array.prototype.subarray.call(this,start,end);
  Object.setPrototypeOf(view,Buffer.prototype);
  return view;
};
export { Buffer };
