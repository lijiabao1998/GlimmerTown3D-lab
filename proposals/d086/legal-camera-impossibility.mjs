// A diagnostic proof, never an exemption or pass condition. All samples remain
// mandatory and fail the original D081 coverage assertion until legitimately seen.
import assert from 'node:assert/strict';
export function minimumLegalRayDot(normal){
 assert.ok(Array.isArray(normal)&&normal.length===3&&normal.every(Number.isFinite));assert.ok(Math.abs(Math.hypot(...normal)-1)<1e-8);
 const h=Math.hypot(normal[0],normal[2]),lo=Math.PI*.08,hi=Math.PI*.32;
 // Minimize over yaw analytically, then elevation. f(e)=-h*cos(e)-ny*sin(e).
 const candidates=[lo,hi],stationary=Math.atan2(normal[1],h);
 for(const angle of [stationary,stationary+Math.PI,stationary-Math.PI])if(angle>lo&&angle<hi)candidates.push(angle);
 return Math.min(...candidates.map(e=>-h*Math.cos(e)-normal[1]*Math.sin(e)));
}
export function impossibleLegalCameraSamples(contract){return contract.probes.filter(p=>p.required&&minimumLegalRayDot(p.normal)>=1e-10).map(p=>({...p,minimumLegalRayDot:minimumLegalRayDot(p.normal)}));}
