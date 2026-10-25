// Explicit opt-in inspection seam proposal; never edits production by itself.
import assert from 'node:assert/strict';
export const INSPECTION_STATE_BLOCK=`// D086-BEGIN inspection-camera
  type D086InspectionView = { owner: number; pos: [number, number, number]; target: [number, number, number]; fov: 60; near: 0.1; far: number };
  const inspectionEnabled = q.get('d086Inspection') === '1';
  let inspectionCamera: THREE.PerspectiveCamera | null = null, inspectionTarget: THREE.Vector3 | null = null, inspectionOwner: number | null = null;
  const inspectionState = () => ({ enabled: inspectionEnabled, active: inspectionCamera !== null, owner: inspectionOwner,
    camera: inspectionCamera ? { pos: inspectionCamera.position.toArray(), target: inspectionTarget!.toArray(), up: inspectionCamera.up.toArray(), fov: inspectionCamera.fov, near: inspectionCamera.near, far: inspectionCamera.far, aspect: inspectionCamera.aspect, projectionMatrix: inspectionCamera.projectionMatrix.toArray(), matrixWorld: inspectionCamera.matrixWorld.toArray() } : null,
    player: { pos: cam.position.toArray(), target: controls.target.toArray(), up: cam.up.toArray(), zoom: cam.zoom, near: cam.near, far: cam.far, minPolarAngle: controls.minPolarAngle, maxPolarAngle: controls.maxPolarAngle, minZoom: controls.minZoom, maxZoom: controls.maxZoom } });
  function setInspectionView(view: D086InspectionView | null) {
    if (!inspectionEnabled) throw new Error('D086 inspection requires explicit query opt-in');
    if (view === null) { inspectionCamera = null; inspectionTarget = null; inspectionOwner = null; needsRender = true; draw(); return inspectionState(); }
    if (!sim || !city || !built || playing || stroke) throw new Error('D086 inspection requires a paused native world without held input');
    const keys = ['far', 'fov', 'near', 'owner', 'pos', 'target'];
    if (typeof view !== 'object' || Object.keys(view).sort().join(',') !== keys.join(',')) throw new Error('D086 inspection exact camera fields required');
    if (!Number.isInteger(view.owner) || view.owner <= 0 || ![view.pos, view.target].every(p => Array.isArray(p) && p.length === 3 && p.every(Number.isFinite)) || view.fov !== 60 || view.near !== .1 || view.far !== city.n * 6 || !(innerWidth > 0 && innerHeight > 0)) throw new Error('D086 inspection finite original clipping bounds required');
    const owner = city.buildings.find(b => b.id === view.owner);
    if (!owner || !civicMarketSlot(owner.k, owner.v) || owner.age < 9 || owner.goneDay !== undefined) throw new Error('D086 inspection requires a completed current native owner');
    const pos = new THREE.Vector3(...view.pos), target = new THREE.Vector3(...view.target);
    if (!(pos.y > 0) || pos.distanceTo(target) <= view.near || [...view.pos, ...view.target].some(x => Math.abs(x) > city!.n * 6)) throw new Error('D086 inspection camera must be finite above-ground and noncoincident');
    const next = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, .1, city.n * 6); next.position.copy(pos); next.up.set(0, 1, 0); next.lookAt(target); next.updateProjectionMatrix(); next.updateMatrixWorld(true);
    const previous = { camera: inspectionCamera, target: inspectionTarget, owner: inspectionOwner };
    inspectionCamera = next; inspectionTarget = target; inspectionOwner = view.owner;
    try { needsRender = true; draw(); } catch (error) { inspectionCamera = previous.camera; inspectionTarget = previous.target; inspectionOwner = previous.owner; needsRender = true; throw error; }
    return inspectionState();
  }
// D086-END inspection-camera
`;
export function inspectionSources(city,post){
 const anchor='  // D010 逐日模擬';assert.equal(city.split(anchor).length,2);city=city.replace(anchor,INSPECTION_STATE_BLOCK+anchor);
 const importAnchor="import { HERITAGE_TOOLS, NATIVE_ART_TOOLS } from './sim/edit.ts';";assert.equal(city.split(importAnchor).length,2);city=city.replace(importAnchor,importAnchor+"\nimport { civicMarketSlot } from './content/britishCivicMarkets.ts';");
 const draw="    pipe.render(renderer, built.scene, cam, style, innerWidth, innerHeight, Math.min(devicePixelRatio || 1, 2));";assert.equal(city.split(draw).length,2);city=city.replace(draw,draw.replace('built.scene, cam,','built.scene, inspectionCamera ?? cam,'));
 const hook="    cam: () => ({ pos: cam.position.toArray(), target: controls.target.toArray(), zoom: cam.zoom }),";assert.equal(city.split(hook).length,2);city=city.replace(hook,hook+"\n// D086-BEGIN inspection-hook\n    inspectionView: setInspectionView,\n    inspectionState,\n// D086-END inspection-hook");
 const type='cam: THREE.OrthographicCamera, style: Style';assert.equal(post.split(type).length,2);post=post.replace(type,'cam: THREE.OrthographicCamera | THREE.PerspectiveCamera, style: Style');return{city,post};
}
