// Read-only upload diagnostics copied from the existing D067 probe.
// Captures the actual bufferData/bufferSubData bytes without modifying inputs or GL results.
// A mismatch remains a failed review: this probe supplies no normal tolerance or exemptions.
export function installRedesignUploadProbe(){
 const proto=WebGL2RenderingContext.prototype,original={bufferData:proto.bufferData,bufferSubData:proto.bufferSubData};
 const ids=new WeakMap(),records=[],errors=[];
 const wordHash=a=>{const u=new Uint32Array(a.buffer,a.byteOffset,a.byteLength>>2);let h=0x811c9dc5;for(let i=0;i<u.length;i++)h=Math.imul(h^u[i],0x01000193)>>>0;return(Math.imul(h^u.length,0x01000193)>>>0).toString(16).padStart(8,'0');};
 const binding=(gl,target)=>target===gl.ARRAY_BUFFER?gl.getParameter(gl.ARRAY_BUFFER_BINDING):target===gl.ELEMENT_ARRAY_BUFFER?gl.getParameter(gl.ELEMENT_ARRAY_BUFFER_BINDING):null;
 function record(gl,target){const buffer=binding(gl,target);if(!buffer)return null;let r=ids.get(buffer);if(!r){r={id:records.length,target,bytes:new Uint8Array(0),float32:false,uploads:0,subUpdates:0};ids.set(buffer,r);records.push(r);}return r;}
 function sourceBytes(data,offset=0,length=0){
  const view=ArrayBuffer.isView(data),size=view?data.BYTES_PER_ELEMENT??1:1,total=view?data.byteLength/size:data.byteLength;
  const count=length===0?total-offset:length;
  return new Uint8Array(view?data.buffer:data,(view?data.byteOffset:0)+offset*size,count*size);
 }
 proto.bufferData=function(...args){
  const result=Reflect.apply(original.bufferData,this,args);
  try{const r=record(this,args[0]);if(r){const data=args[1];r.bytes=typeof data==='number'?new Uint8Array(data):sourceBytes(data,args[3]??0,args[4]??0).slice();r.float32=data instanceof Float32Array;r.uploads++;}}
  catch(e){errors.push('bufferData capture: '+String(e));}
  return result;
 };
 proto.bufferSubData=function(...args){
  const result=Reflect.apply(original.bufferSubData,this,args);
  try{const r=record(this,args[0]);if(r){const data=sourceBytes(args[2],args[3]??0,args[4]??0);if(args[1]+data.byteLength>r.bytes.byteLength)throw Error('subData exceeds recorded GPU buffer');r.bytes.set(data,args[1]);r.float32 ||= args[2] instanceof Float32Array;r.subUpdates++;}}
  catch(e){errors.push('bufferSubData capture: '+String(e));}
  return result;
 };
 window.__d082RedesignUploadProbe={
  errors,
  summary:()=>records.map(r=>({id:r.id,target:r.target,bytes:r.bytes.byteLength,float32:r.float32,uploads:r.uploads,subUpdates:r.subUpdates})),
  select:spec=>records.filter(r=>r.float32&&r.bytes.byteLength===spec.capacity*4).map(r=>{
   const a=new Float32Array(r.bytes.buffer,r.bytes.byteOffset+spec.start*4,spec.length);
   return {id:r.id,capacity:r.bytes.byteLength/4,hash:wordHash(a),uploads:r.uploads,subUpdates:r.subUpdates};
  }).filter(r=>r.hash===spec.hash),
  bits:(id,start,length)=>{const r=records[id];if(!r)throw Error('unknown captured buffer');return Array.from(new Uint32Array(r.bytes.buffer,r.bytes.byteOffset+start*4,length));},
  stop:()=>{proto.bufferData=original.bufferData;proto.bufferSubData=original.bufferSubData;},
 };
}
export const REDESIGN_UPLOAD_PROBE='('+installRedesignUploadProbe.toString()+')();';
