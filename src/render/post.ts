// 後製：先把場景畫進（可能是低解析度的）render target，再用全螢幕四邊形放大到畫面。
// 描邊＝深度跳變；量化＝在 sRGB 空間把每個色版壓成有限階數。三種畫風只是參數不同。
import * as THREE from 'three';
import type { Style } from './styles.ts';

const FRAG = /* glsl */ `
uniform sampler2D tColor;
uniform sampler2D tDepth;
uniform vec2 texel;
uniform float outline;
uniform float quant;
uniform float depthRange;
varying vec2 vUv;
void main() {
  vec4 c = texture2D(tColor, vUv);
  if (outline > 0.5) {
    float d = texture2D(tDepth, vUv).r;
    float e = 0.0;
    e = max(e, abs(d - texture2D(tDepth, vUv + vec2(texel.x, 0.0)).r));
    e = max(e, abs(d - texture2D(tDepth, vUv - vec2(texel.x, 0.0)).r));
    e = max(e, abs(d - texture2D(tDepth, vUv + vec2(0.0, texel.y)).r));
    e = max(e, abs(d - texture2D(tDepth, vUv - vec2(0.0, texel.y)).r));
    if (e * depthRange > 0.35) c.rgb *= 0.34;
  }
  gl_FragColor = c;
  #include <colorspace_fragment>
  if (quant > 0.5) gl_FragColor.rgb = floor(gl_FragColor.rgb * quant + 0.5) / quant;
}`;

export class Pipeline {
  private rt: THREE.WebGLRenderTarget;
  private quadScene = new THREE.Scene();
  private quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private mat: THREE.ShaderMaterial;
  sceneInfo = { calls: 0, triangles: 0 };

  constructor() {
    this.rt = new THREE.WebGLRenderTarget(1, 1, { depthBuffer: true });
    this.rt.depthTexture = new THREE.DepthTexture(1, 1);
    this.rt.texture.magFilter = this.rt.texture.minFilter = THREE.NearestFilter;
    this.rt.texture.generateMipmaps = false;
    this.mat = new THREE.ShaderMaterial({
      uniforms: {
        tColor: { value: this.rt.texture }, tDepth: { value: this.rt.depthTexture },
        texel: { value: new THREE.Vector2() }, outline: { value: 0 }, quant: { value: 0 }, depthRange: { value: 1 },
      },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: FRAG,
      depthTest: false, depthWrite: false,
    });
    this.quadScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.mat));
  }

  // cssW/cssH＝畫布的 CSS 尺寸；dpr＝實際像素比。像素風用 CSS 尺寸除以 pixelCss，其餘用裝置像素
  render(renderer: THREE.WebGLRenderer, scene: THREE.Scene, cam: THREE.OrthographicCamera, style: Style, cssW: number, cssH: number, dpr: number) {
    const w = style.pixelCss > 1 ? Math.max(1, Math.floor(cssW / style.pixelCss)) : Math.max(1, Math.floor(cssW * dpr));
    const h = style.pixelCss > 1 ? Math.max(1, Math.floor(cssH / style.pixelCss)) : Math.max(1, Math.floor(cssH * dpr));
    if (this.rt.width !== w || this.rt.height !== h) this.rt.setSize(w, h);
    renderer.setRenderTarget(this.rt);
    renderer.render(scene, cam);
    // three.js 每次 render 都會把統計歸零；這裡記下「城市這一趟」的數字，否則讀到的是後製四邊形（1 次呼叫、2 個三角形）
    this.sceneInfo = { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles };
    renderer.setRenderTarget(null);
    const u = this.mat.uniforms;
    u.texel.value.set(1 / w, 1 / h);
    u.outline.value = style.outline ? 1 : 0;
    u.quant.value = style.quant;
    u.depthRange.value = cam.far - cam.near;
    renderer.render(this.quadScene, this.quadCam);
  }

  get size() { return [this.rt.width, this.rt.height]; }
}
