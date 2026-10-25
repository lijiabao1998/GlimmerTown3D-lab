// 後製：先把場景畫進（可能是低解析度的）render target，再用全螢幕四邊形放大到畫面。
// 描邊＝深度跳變；量化＝在 sRGB 空間把每個色版壓成有限階數。三種畫風只是參數不同。
import * as THREE from 'three';
import type { Style } from './styles.ts';
// D062-BEGIN weather-import
import { WEATHER_GLSL_UNIFORMS, WEATHER_GLSL_FNS, WEATHER_GLSL_APPLY, tintSky, type WeatherLook } from './weatherArt.ts';
// D062-END weather-import

const FRAG = /* glsl */ `
uniform sampler2D tColor;
uniform sampler2D tDepth;
uniform vec2 texel;
uniform float outline;
uniform float quant;
uniform float depthRange;
// D061-BEGIN land-sky-uniforms
uniform float sky;
uniform vec3 skyA;
uniform vec3 skyB;
uniform vec3 skyC;
uniform vec3 skyD;
// D061-END land-sky-uniforms
// D062-BEGIN weather-glsl-decl
${WEATHER_GLSL_UNIFORMS}
${WEATHER_GLSL_FNS}
// D062-END weather-glsl-decl
varying vec2 vUv;
void main() {
  vec4 c = texture2D(tColor, vUv);
// D061-BEGIN land-sky-mix
  if (sky > 0.5 && texture2D(tDepth, vUv).r > 0.99999) {   // 背景（深度＝遠平面）換成天空；描邊照舊乘在上面
    if (sky > 1.5) {   // 不量化的畫風（B、C）：四個色階之間線性漸層，不抖動
      float g = clamp((vUv.y - 0.125) / 0.75, 0.0, 1.0) * 3.0;
      c.rgb = g < 1.0 ? mix(skyD, skyC, g) : g < 2.0 ? mix(skyC, skyB, g - 1.0) : mix(skyB, skyA, g - 2.0);
    } else {   // 量化的畫風（A）：四階色帶，帶與帶之間照渲染像素抖動（連續漸層會在量化時三個色版各自跳階，出現偏紫、偏青的怪帶）
      float n = fract(sin(dot(floor(vUv / texel), vec2(12.9898, 78.233))) * 43758.5453);
      float s = clamp(vUv.y + (n - 0.5) * 0.035, 0.0, 1.0);
      c.rgb = s > 0.75 ? skyA : s > 0.5 ? skyB : s > 0.25 ? skyC : skyD;
    }
  }
// D061-END land-sky-mix
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
// D062-BEGIN weather-glsl-apply
  ${WEATHER_GLSL_APPLY}
// D062-END weather-glsl-apply
  if (quant > 0.5) gl_FragColor.rgb = floor(gl_FragColor.rgb * quant + 0.5) / quant;
}`;

export class Pipeline {
  private rt: THREE.WebGLRenderTarget;
  private quadScene = new THREE.Scene();
  private quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private mat: THREE.ShaderMaterial;
  sceneInfo = { calls: 0, triangles: 0 };
// D061-BEGIN land-sky-prop
  sky: THREE.Color[] | null = null;   // D061：天空四階色帶，由上到下（零幾何；null＝舊的平色背景，畫面逐位元組不變）
// D061-END land-sky-prop
// D062-BEGIN weather-prop
  weather: { look: WeatherLook; time: number; rainbow: number; flash: number } | null = null;   // D062：這一幀的天氣（null＝晴；著色器那一段整個跳過，畫面逐位元組不變）
  sceneFrames = 0; postFrames = 0;                                                               // 守衛量「動畫只重跑後製」：場景那趟與後製那趟各跑了幾次
  private last: { w: number; h: number; quant: number } | null = null;
// D062-END weather-prop

  constructor() {
    this.rt = new THREE.WebGLRenderTarget(1, 1, { depthBuffer: true });
    this.rt.depthTexture = new THREE.DepthTexture(1, 1);
    this.rt.texture.magFilter = this.rt.texture.minFilter = THREE.NearestFilter;
    this.rt.texture.generateMipmaps = false;
    this.mat = new THREE.ShaderMaterial({
      uniforms: {
        tColor: { value: this.rt.texture }, tDepth: { value: this.rt.depthTexture },
        texel: { value: new THREE.Vector2() }, outline: { value: 0 }, quant: { value: 0 }, depthRange: { value: 1 },
// D061-BEGIN land-sky-init
        sky: { value: 0 }, skyA: { value: new THREE.Color() }, skyB: { value: new THREE.Color() }, skyC: { value: new THREE.Color() }, skyD: { value: new THREE.Color() },
// D061-END land-sky-init
// D062-BEGIN weather-init
        wx: { value: 0 }, wxT: { value: 0 }, rainbow: { value: 0 }, flash: { value: 0 }, aspect: { value: 1 }, res: { value: new THREE.Vector2(1, 1) },
// D062-END weather-init
      },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: FRAG,
      depthTest: false, depthWrite: false,
    });
    this.quadScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.mat));
  }

  // cssW/cssH＝畫布的 CSS 尺寸；dpr＝實際像素比。像素風用 CSS 尺寸除以 pixelCss，其餘用裝置像素
  render(renderer: THREE.WebGLRenderer, scene: THREE.Scene, cam: THREE.OrthographicCamera | THREE.PerspectiveCamera, style: Style, cssW: number, cssH: number, dpr: number) {
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
// D061-BEGIN land-sky-set
    u.sky.value = this.sky ? (style.quant > 0 ? 1 : 2) : 0;   // 1＝量化畫風的色帶、2＝不量化畫風的漸層、0＝舊的平色背景
    if (this.sky) { u.skyA.value.copy(this.sky[0]); u.skyB.value.copy(this.sky[1]); u.skyC.value.copy(this.sky[2]); u.skyD.value.copy(this.sky[3]); }
// D061-END land-sky-set
// D062-BEGIN weather-set
    this.last = { w, h, quant: style.quant }; this.sceneFrames++;
    this.setWeather();
// D062-END weather-set
    renderer.render(this.quadScene, this.quadCam);
  }
// D062-BEGIN weather-method
  // 天氣的 uniform（render 與 renderPost 共用）。量化畫風（A）的天空色階事先套同一個色調、貼回輸出色格子；不量化的畫風（B、C）由著色器直接混
  private setWeather() {
    if (!this.last) return;
    const u = this.mat.uniforms, wx = this.weather;
    u.wx.value = wx ? wx.look : 0; u.wxT.value = wx ? wx.time : 0; u.rainbow.value = wx ? wx.rainbow : 0; u.flash.value = wx ? wx.flash : 0;
    u.aspect.value = this.last.w / this.last.h; u.res.value.set(this.last.w, this.last.h);
    if (this.sky) {   // 沒有色調時照 D061 的做法 copy（逐位元組同 D061）；有色調才用事先算好的四個色
      if (wx && wx.look > 0 && this.last.quant > 0) { const c = tintSky(this.sky.map(k => k.getHex()), wx.look, this.last.quant); u.skyA.value.set(c[0]); u.skyB.value.set(c[1]); u.skyC.value.set(c[2]); u.skyD.value.set(c[3]); }
      else { u.skyA.value.copy(this.sky[0]); u.skyB.value.copy(this.sky[1]); u.skyC.value.copy(this.sky[2]); u.skyD.value.copy(this.sky[3]); }
    }
  }
  // 只重跑後製這一趟（場景不重畫；降水動畫、彩虹淡出、閃光消退用）。沒有畫過場景就什麼都不做
  renderPost(renderer: THREE.WebGLRenderer) {
    if (!this.last) return;
    this.setWeather(); this.postFrames++;
    renderer.setRenderTarget(null);
    renderer.render(this.quadScene, this.quadCam);
  }
// D062-END weather-method

  get size() { return [this.rt.width, this.rt.height]; }
}
