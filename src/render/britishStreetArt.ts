// D058：英式街道的本地量體。沿用 D008 配方、分戶與分排；只換外觀，不讀寫城市。
// +z 是正面；呼叫端處理道路朝向、owner 與快取。三個 Geo 沿用既有批次，小件一律放不投影的 D。
import * as THREE from 'three';
import type { Geo } from './scene.ts';
import type { DrawBlock } from '../content/blocks.ts';
import { PX_PER_CELL, shade, type Recipe } from '../content/recipes.ts';
import type { FacadePlan } from '../content/facades.ts';
import { dressing } from '../content/dressing.ts';
import type { ArtCounts, YardTree } from './blockArt.ts';
import { WIN_STYLE } from './windows.ts';

type V3 = [number, number, number];
interface Face { x: number; z: number; tx: number; tz: number; nx: number; nz: number }
const C = (s: string) => new THREE.Color(s);
const P = (n: number) => n / PX_PER_CELL;
const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));
const STONE = '#e6dec9', GLASS = '#27364c';
const DOORS = ['#334653', '#455d4b', '#70463f', '#394b55', '#756144'];
const SHOPS = ['#37574f', '#62443f', '#3c5169', '#786044'];
const face = (x: number, z: number, tx: number, tz: number, nx: number, nz: number): Face => ({ x, z, tx, tz, nx, nz });
const at = (f: Face, t: number, y: number, out = 0): V3 => [f.x + f.tx * t + f.nx * out, y, f.z + f.tz * t + f.nz * out];
function panel(G: Geo, f: Face, a: number, b: number, ya: number, yb: number, c: string, out = 0) {
  if (b - a < 1e-6 || yb - ya < 1e-6) return;
  G.quad(at(f, a, ya, out), at(f, b, ya, out), at(f, b, yb, out), at(f, a, yb, out), [f.nx, 0, f.nz], C(c));
}
function slab(G: Geo, x0: number, z0: number, x1: number, z1: number, y: number, c: string) {
  if (x1 - x0 < 1e-6 || z1 - z0 < 1e-6) return;
  G.quad([x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1], [0, 1, 0], C(c));
}
// 窗台／簷口只畫露出的正面和上表面，不生出貼牆背面、底面或共用內牆。
function ledge(G: Geo, f: Face, a: number, b: number, y: number, h: number, dep: number, c: string, out = 0) {
  panel(G, f, a, b, y, y + h, c, out + dep);
  if (dep > 1e-6 && b - a > 1e-6) G.quad(at(f, a, y + h, out), at(f, b, y + h, out), at(f, b, y + h, out + dep), at(f, a, y + h, out + dep), [0, 1, 0], C(shade(c, 8)));
}
function window(G: Geo, f: Face, cx: number, y: number, w: number, h: number, detailed: boolean, trim = STONE) {
  const t = Math.min(.013, w * .095, h * .13), o = .004;
  panel(G, f, cx - w / 2, cx + w / 2, y, y + h, trim, o);
  panel(G, f, cx - w / 2 + t, cx + w / 2 - t, y + t, y + h - t, GLASS, o + .001);
  if (detailed) {
    panel(G, f, cx - w / 2 + t, cx + w / 2 - t, y + h * .51, y + h * .51 + t * .45, trim, o + .002);
    G.quad(at(f, cx - w / 2, y, o), at(f, cx + w / 2, y, o), at(f, cx + w / 2, y, o + .012), at(f, cx - w / 2, y, o + .012), [0, 1, 0], C(trim));
  }
}
function entrance(G: Geo, f: Face, cx: number, y: number, w: number, h: number, color: string, main: boolean, step: number) {
  const border = Math.min(.016, w * .14), o = .005;
  panel(G, f, cx - w / 2 - border, cx + w / 2 + border, y, y + h + border, main ? STONE : '#918778', o);
  panel(G, f, cx - w / 2, cx + w / 2, y, y + h, color, o + .001);
  if (main) {
    panel(G, f, cx - w * .36, cx + w * .36, y + h * .80, y + h * .94, '#73919a', o + .002);
    panel(G, f, cx - w * .32, cx + w * .32, y + h * .17, y + h * .61, shade(color, 13), o + .002);
    const k = Math.min(.006, w * .07);
    panel(G, f, cx + w * .25 - k, cx + w * .25 + k, y + h * .46, y + h * .46 + k * 2, '#c9b585', o + .003);
  }
  if (step > .008) ledge(G, f, cx - w * .67, cx + w * .67, y, .006, step, '#b3aa94');
}
// 不使用 Geo.hip 的退化四邊形：狹長、短胖和正方形都保有真正的三角面。
function hip(G: Geo, a: number, b: number, za: number, zb: number, y: number, rise: number, color: string) {
  const cx = (a + b) / 2, cz = (za + zb) / 2, yr = y + rise, w = b - a, d = zb - za, c = C(color);
  if (Math.abs(w - d) < 1e-6) {
    const t: V3 = [cx, yr, cz], p: V3[] = [[a, y, za], [b, y, za], [b, y, zb], [a, y, zb]];
    for (let i = 0; i < 4; i++) G.triangle(p[i], p[(i + 1) % 4], t, [p[i][0] + p[(i + 1) % 4][0] - 2 * cx, 1, p[i][2] + p[(i + 1) % 4][2] - 2 * cz], c);
  } else if (w > d) {
    const r0: V3 = [a + d / 2, yr, cz], r1: V3 = [b - d / 2, yr, cz];
    G.slope([a, y, zb], [b, y, zb], r1, r0, [0, 1, 1], c);
    G.slope([a, y, za], [b, y, za], r1, r0, [0, 1, -1], c);
    G.triangle([a, y, za], [a, y, zb], r0, [-1, 1, 0], c);
    G.triangle([b, y, za], [b, y, zb], r1, [1, 1, 0], c);
  } else {
    const r0: V3 = [cx, yr, za + w / 2], r1: V3 = [cx, yr, zb - w / 2];
    G.slope([a, y, za], [a, y, zb], r1, r0, [-1, 1, 0], c);
    G.slope([b, y, za], [b, y, zb], r1, r0, [1, 1, 0], c);
    G.triangle([a, y, za], [b, y, za], r0, [0, 1, -1], c);
    G.triangle([a, y, zb], [b, y, zb], r1, [0, 1, 1], c);
  }
}
// 店屋的角部在牆、屋頂同時切角；外角屋面收成兩片斜坡，沒有藏在牆內的圓柱。
function shopRoof(G: Geo, a: number, b: number, za: number, zb: number, y: number, rise: number, lc: number, rc: number, color: string, wall: string, left: boolean, right: boolean) {
  const cz = (za + zb) / 2, yr = y + rise, ra = a + lc, rb = b - rc, c = C(color);
  const r0: V3 = [ra, yr, cz], r1: V3 = [rb, yr, cz];
  G.slope([ra, y, zb], [rb, y, zb], r1, r0, [0, 1, 1], c);
  G.slope([a, y, za], [b, y, za], r1, r0, [0, 1, -1], c);
  if (lc) {
    G.triangle([a, y, za], [a, y, zb - lc], r0, [-1, 1, 0], c);
    G.triangle([a, y, zb - lc], [ra, y, zb], r0, [-1, 1, 1], c);
  } else if (left) G.triangle([a, y, za], [a, y, zb], r0, [-1, 0, 0], C(wall));
  if (rc) {
    G.triangle([b, y, za], [b, y, zb - rc], r1, [1, 1, 0], c);
    G.triangle([b, y, zb - rc], [rb, y, zb], r1, [1, 1, 1], c);
  } else if (right) G.triangle([b, y, za], [b, y, zb], r1, [1, 0, 0], C(wall));
}
function pot(G: Geo, cx: number, cz: number, y: number, r: number, h: number) {
  G.box(cx - r, cz - r, cx + r, cz + r, y, y + h, C('#9a5e43'), C('#b37b58'), null);
  slab(G, cx - r * .58, cz - r * .58, cx + r * .58, cz + r * .58, y + h + .001, '#302c29');
}

export function drawBritishStreet(W: Geo, O: Geo, D: Geo, bk: DrawBlock, r: Recipe, f: FacadePlan, y0: number, trees: YardTree[], counts: ArtCounts,
  roads: { front: boolean; left: boolean; right: boolean; back: boolean }): THREE.Vector3 {
  const x0 = bk.x + r.box[0] * bk.w, x1 = bk.x + r.box[1] * bk.w, z0 = bk.z + r.box[2] * bk.h, z1 = bk.z + r.box[3] * bk.h;
  const width = x1 - x0, depth = z1 - z0, h = P(r.wallPx), yw = y0 + h, U = (u: number) => x0 + u * width;
  const semi = f.style === 'ukSemi', vict = f.style === 'ukVictorian', shop = f.style === 'ukHighStreet';
  const floorN = vict ? clamp(Math.round(h / .30), 2, 4) : 2, fh = h / floorN, units = f.units, lastRow = f.rows.length - 1;
  const front = face(x0, z1, 1, 0, 0, 1), back = face(x0, z0, 1, 0, 0, -1);
  const margin = Math.max(0, bk.z + bk.h - z1), proj = Math.min(.075, margin * .31);
  const part = (kind: string, n = 1) => { counts.parts += n; counts.partKinds[kind] = (counts.partKinds[kind] ?? 0) + n; };
  const corners = { left: shop && roads.left, right: shop && roads.right };
  const cornerSize = (i: number) => Math.min((units[i].u1 - units[i].u0) * width * .23, depth * .18, .17);
  const lc = corners.left ? cornerSize(0) : 0, rc = corners.right ? cornerSize(units.length - 1) : 0;
  const rowZ = (i: number): [number, number] => [z0 + f.rows[i].v0 * depth, z0 + f.rows[i].v1 * depth];
  const shopRise = (i: number, ri: number) => P(f.rows[ri].risePx) * [1, .79, .91][(i + Math.abs(r.v)) % 3];
  const body = (ff: Face, a: number, b: number, top: number, wall: string, upper?: string) => {
    if (upper) { panel(W, ff, a, b, y0, y0 + h * .5, wall); panel(W, ff, a, b, y0 + h * .5, top, upper); }
    else panel(W, ff, a, b, y0, top, wall);
  };
  // 只畫外殼：連戶、背靠背排之間的四面內牆全部省掉；半獨立的車道縫仍有完整側牆。
  for (let ri = 0; ri <= lastRow; ri++) {
    const [za, zb] = rowZ(ri), rise = P(f.rows[ri].risePx);
    for (let i = 0; i < units.length; i++) {
      const u = units[i], a = U(u.u0), b = U(u.u1), top = yw + P(u.dhPx);
      const left = i === 0 || u.u0 - units[i - 1].u1 > 1e-6, right = i === units.length - 1 || units[i + 1].u0 - u.u1 > 1e-6;
      if (ri === lastRow) body(front, a - x0 + (i === 0 ? lc : 0), b - x0 - (i === units.length - 1 ? rc : 0), top, u.wall, u.upper);
      if (ri === 0) body(back, a - x0, b - x0, top, u.wall, u.upper);
      if (left) body(face(a, za, 0, 1, -1, 0), 0, zb - za - (ri === lastRow && i === 0 ? lc : 0), top, u.wall, u.upper);
      if (right) body(face(b, za, 0, 1, 1, 0), 0, zb - za - (ri === lastRow && i === units.length - 1 ? rc : 0), top, u.wall, u.upper);
      if (shop) {
        const cr = shopRise(i, ri);
        shopRoof(O, a, b, za, zb, top, cr, i === 0 ? lc : 0, i === units.length - 1 ? rc : 0, f.roofColor, u.wall, left, right);
        // 每戶坡頂高度不同，僅補相鄰屋坡之間真正露出的兩個三角面。
        if (i && Math.abs(cr - shopRise(i - 1, ri)) > 1e-6) {
          const prev = shopRise(i - 1, ri), cz = (za + zb) / 2, low: V3 = [a, top + Math.min(cr, prev), cz], high: V3 = [a, top + Math.max(cr, prev), cz];
          const away: V3 = [cr > prev ? -1 : 1, 0, 0];
          O.triangle([a, top, za], low, high, away, C(shade(u.wall, -8)));
          O.triangle([a, top, zb], low, high, away, C(shade(u.wall, -8)));
        }
      }
    }
    if (semi) {
      for (let i = 0; i < units.length; i += 2) hip(O, U(units[i].u0), U(units[Math.min(i + 1, units.length - 1)].u1), za, zb, yw, rise, f.roofColor);
    } else if (!vict && !shop) {
      // 長石板屋脊；只有街區兩端才封山牆，不在每戶間疊三角面。
      shopRoof(O, x0, x1, za, zb, yw, rise, 0, 0, f.roofColor, units[0].wall, true, true);
    }
    counts.rows++;
  }
  counts.units += units.length;
  // 前後簷口；房子的輪廓由屋頂投影，小簷和所有裝飾不增加 shadow pass。
  const eaveSpans: [number, number][] = semi
    ? units.filter((_, i) => i % 2 === 0).map((u, i) => [u.u0 * width, units[Math.min(i * 2 + 1, units.length - 1)].u1 * width])
    : [[lc, width - rc]];
  for (const [a, b] of eaveSpans) {
    ledge(D, front, a, b, yw - .016, .016, Math.min(.012, margin * .12), vict ? STONE : shade(f.roofColor, -19));
    ledge(D, back, semi ? a : 0, semi ? b : width, yw - .012, .012, .008, vict ? STONE : shade(f.roofColor, -19));
    counts.trims += 2;
  }
  if (vict) {
    slab(O, x0, z0, x1, z1, yw, f.roofColor);
    // 真正的低女兒牆：屋頂邊四面＋壓頂，屋面不冒充一整塊加高的牆體。
    const ph = P(2), th = Math.min(.026, width * .04, depth * .04);
    for (const [ff, len] of [[front, width], [back, width], [face(x0, z0, 0, 1, -1, 0), depth], [face(x1, z0, 0, 1, 1, 0), depth]] as [Face, number][]) {
      panel(D, ff, 0, len, yw, yw + ph, STONE, 0);
      panel(D, { ...ff, nx: -ff.nx, nz: -ff.nz }, 0, len, yw, yw + ph, shade(STONE, -14), th);
      D.quad(at(ff, 0, yw + ph), at(ff, len, yw + ph), at(ff, len, yw + ph, -th), at(ff, 0, yw + ph, -th), [0, 1, 0], C(STONE));
    }
    ledge(D, front, 0, width, y0 + fh, .022, .022, STONE);
    panel(D, front, 0, width, y0 + fh + .028, y0 + fh + .06, '#454a4a', .022);
    counts.trims += 5; part('parapet'); part('balcony');
  }
  const doors: number[] = [];
  // 正面逐戶：门的位置由窗灣让開；半獨立成對鏡像，每戶各有真正的門板和泛光窗。
  for (let i = 0; i < units.length; i++) {
    const u = units[i], a = U(u.u0) - x0, b = U(u.u1) - x0, uw = b - a, mirror = semi && i % 2 === 0;
    const dc = a + uw * (semi ? (mirror ? .78 : .22) : .24), dw = Math.min(.13, uw * .19), dh = fh * (shop ? .73 : .84);
    const corner = shop && (i === 0 && lc > 0 || i === units.length - 1 && rc > 0);
    doors.push(x0 + dc);
    if (!corner) {
      entrance(D, front, dc, y0, dw, dh, DOORS[(i + Math.abs(r.v)) % DOORS.length], true, Math.min(.022, margin * .12));
      counts.doors++; part('door');
    }
    if (shop) {
      const sa = a + (i === 0 ? lc : 0), sb = b - (i === units.length - 1 ? rc : 0), sw = sb - sa, c = SHOPS[(i + Math.abs(r.v)) % SHOPS.length];
      // 地面店窗和招牌是獨立幾何，上層永遠用住宅窗，不沿用整牆 shop atlas。
      panel(D, front, sa + sw * .04, sb - sw * .04, y0 + .008, y0 + fh * .97, c, .003);
      const wa = corner ? sa + sw * .09 : Math.max(sa + sw * .40, dc + dw * .66), wb = sb - sw * .09;
      panel(D, front, wa, wb, y0 + fh * .17, y0 + fh * .75, '#7399a6', .004);
      panel(D, front, (wa + wb) / 2 - .004, (wa + wb) / 2 + .004, y0 + fh * .17, y0 + fh * .75, STONE, .005);
      panel(D, front, sa + sw * .04, sb - sw * .04, y0 + fh * .78, y0 + fh * .97, c, .008);
      panel(D, front, sa + sw * .28, sb - sw * .20, y0 + fh * .85, y0 + fh * .89, '#e0d3ab', .009);
      counts.shopBands++; part('shopfront'); part('sign');
      for (const t of [.27, .72]) { window(D, front, sa + sw * t, y0 + fh * 1.27, sw * .23, fh * .49, true); part('upperWindow'); }
      continue;
    }
    if (vict) {
      window(D, front, a + uw * .71, y0 + fh * .27, uw * .27, fh * .53, true); part('frontWindow');
      for (let j = 1; j < floorN; j++) for (const t of [.25, .72]) { window(D, front, a + uw * t, y0 + fh * (j + .22), uw * .26, fh * .57, j === 1); part('upperWindow'); }
      panel(D, front, a, a + Math.min(.025, uw * .08), y0, yw - .018, shade(u.wall, 18), .006); part('pier');
      if (i === units.length - 1) { panel(D, front, b - Math.min(.025, uw * .08), b, y0, yw - .018, shade(u.wall, 18), .006); part('pier'); }
    } else {
      const bp = f.parts.find(p => (p.kind === (semi ? 'bay2' : 'bay')) && p.u >= u.u0 && p.u <= u.u1);
      const bc = bp ? U(bp.u) - x0 : a + uw * (mirror ? .26 : .74), bw = bp ? bp.w * width : uw * .32;
      const bh = semi ? h * .90 : fh * .87, dep = Math.max(.016, proj), xa = bc - bw / 2, xb = bc + bw / 2, cut = bw * .17;
      const points: [number, number][] = [[xa, z1], [xa + cut, z1 + dep], [xb - cut, z1 + dep], [xb, z1]];
      for (let j = 0; j < 3; j++) {
        const [ax, az] = points[j], [bx, bz] = points[j + 1], len = Math.hypot(bx - ax, bz - az), ff = face(x0 + ax, az, (bx - ax) / len, (bz - az) / len, -(bz - az) / len, (bx - ax) / len);
        panel(D, ff, 0, len, y0, y0 + bh, u.upper ?? shade(u.wall, 15));
        for (let fl = 0; fl < (semi ? 2 : 1); fl++) {
          if (j === 1) window(D, ff, len / 2, y0 + fh * (fl + .25), len * .82, fh * .49, true);
          else panel(D, ff, len * .17, len * .83, y0 + fh * (fl + .28), y0 + fh * (fl + .72), GLASS, .002);
        }
      }
      const roofPoints: V3[] = [[x0 + xa, y0 + bh + .012, z1], [x0 + xb, y0 + bh + .012, z1], [x0 + xb - cut, y0 + bh, z1 + dep], [x0 + xa + cut, y0 + bh, z1 + dep]];
      D.slope(...roofPoints as [V3, V3, V3, V3], [0, 1, 1], C(f.roofColor));
      part(semi ? 'bay2' : 'bay');
      if (semi) { window(D, front, dc, y0 + fh * 1.29, uw * .20, fh * .43, true); part('upperWindow'); }
      else for (const t of [.25, .72]) { window(D, front, a + uw * t, y0 + fh * 1.24, uw * .24, fh * .51, true); part('upperWindow'); }
      if (!semi) {
        const hood = Math.min(.035, margin * .15), hw = dw * .75, hy = y0 + dh + .018;
        if ((i + r.v) % 2 === 0) D.slope(at(front, dc - hw, hy + .018), at(front, dc + hw, hy + .018), at(front, dc + hw, hy, hood), at(front, dc - hw, hy, hood), [0, 1, 1], C(f.roofColor));
        else D.triangle(at(front, dc - hw, hy, .009), at(front, dc + hw, hy, .009), at(front, dc, hy + .035, .009), [0, 0, 1], C(STONE));
        part('porch');
      }
    }
  }
  if (semi) {
    for (const p of f.parts.filter(p => p.kind === 'porch')) {
      const cx = U(p.u) - x0, hw = p.w * width / 2, py = y0 + fh * .94, dep = Math.min(.05, margin * .35);
      D.slope(at(front, cx - hw, py + .025), at(front, cx + hw, py + .025), at(front, cx + hw, py, dep), at(front, cx - hw, py, dep), [0, 1, 1], C(f.roofColor));
      for (const t of [cx - hw + .007, cx + hw - .007]) panel(D, front, t - .007, t + .007, y0, py, STONE, dep * .84);
      part('porch');
    }
  }
  // 背面服务门与稀疏小窗。背靠背内部不加门窗；每条车道的两侧才有外窗。
  for (let i = 0; i < units.length; i++) {
    const u = units[i], a = U(u.u0), b = U(u.u1), uw = b - a, dc = a - x0 + uw * .24;
    entrance(D, back, dc, y0, Math.min(.11, uw * .17), fh * .76, '#615c50', false, 0); counts.doors++; part('rearDoor');
    for (let fl = 0; fl < floorN; fl++) { window(D, back, a - x0 + uw * (fl ? .52 : .71), y0 + fh * (fl + .28), uw * .24, fh * .44, false, '#c7c1ad'); part('rearWindow'); }
    for (const side of [-1, 1]) {
      const exposed = side < 0 ? i === 0 || u.u0 - units[i - 1].u1 > 1e-6 : i === units.length - 1 || units[i + 1].u0 - u.u1 > 1e-6;
      if (!exposed) continue;
      const ff = face(side < 0 ? a : b, z0, 0, 1, side, 0), sideShop = shop && (side < 0 ? corners.left : corners.right);
      for (let ri = 0; ri <= lastRow; ri++) {
        const [za, zb] = rowZ(ri), len = zb - za, sc = za - z0 + len * .47;
        for (let fl = sideShop ? 1 : 0; fl < floorN; fl++) { window(D, ff, sc, y0 + fh * (fl + .30), Math.min(.15, len * .24), fh * .43, false); part('sideWindow'); }
      }
      if (sideShop) {
        const cut = side < 0 ? lc : rc, sa = depth * .12, sb = depth - cut, len = sb - sa, color = SHOPS[(i + Math.abs(r.v)) % SHOPS.length];
        panel(D, ff, sa, sb, y0 + .008, y0 + fh * .97, color, .003);
        panel(D, ff, sa + len * .08, sb - len * .08, y0 + fh * .17, y0 + fh * .75, '#7399a6', .004);
        panel(D, ff, sa + len * .15, sb - len * .15, y0 + fh * .83, y0 + fh * .88, '#e0d3ab', .005);
        counts.shopBands++; part('cornerShopfront');
        const q = Math.SQRT1_2, cf = side < 0 ? face(x0, z1 - cut, q, q, -q, q) : face(x1 - cut, z1, q, -q, q, q), clen = cut * Math.SQRT2;
        body(cf, 0, clen, yw, u.wall);
        entrance(D, cf, clen / 2, y0, Math.min(.11, clen * .44), fh * .73, color, true, 0); counts.doors++; part('door'); part('cornerEntrance');
        window(D, cf, clen / 2, y0 + fh * 1.26, clen * .47, fh * .49, true); part('upperWindow');
        ledge(D, cf, 0, clen, yw - .018, .018, .008, STONE); part('corner');
      }
    }
  }
  // 烟囱从屋坡内长出；瓦陶壶口有深色凹口，保持 D008 的位置、排号与数量。
  for (const p of f.parts.filter(p => p.kind === 'chimney')) {
    const ri = p.row ?? lastRow, [za, zb] = rowZ(ri), cx = U(p.u), hw = Math.max(.014, p.w * width / 2), hd = Math.min(.034, (zb - za) * .10);
    const ui = Math.max(0, units.findIndex(u => p.u >= u.u0 && p.u <= u.u1)), cz = vict ? z0 + depth * .23 : (za + zb) / 2;
    let roofY = yw, roofMin = yw;
    if (semi) {
      // 四坡面的下包絡；以較短邊為坡長，因此屋脊沿 x、沿 z 或退成尖頂都成立。
      const pair = Math.floor(ui / 2) * 2, a = U(units[pair].u0), b = U(units[Math.min(pair + 1, units.length - 1)].u1), rise = P(f.rows[ri].risePx);
      const nearestEdge = Math.min(cx - hw - a, b - cx - hw, cz - hd - za, zb - cz - hd);
      roofMin = yw + rise * clamp(2 * nearestEdge / Math.min(b - a, zb - za), 0, 1);
      roofY = yw + rise;
    } else if (shop) {
      // 跨戶煙囱同時檢查兩側真正的屋坡，不能用較高的屋脊估計較低側的底面。
      // 每片屋頂是各斜平面的下包絡；矩形交集四角的最小值也是整個煙囱底面的最小值。
      roofMin = Infinity;
      for (let j = 0; j < units.length; j++) {
        const a = U(units[j].u0), b = U(units[j].u1), xa = Math.max(a, cx - hw), xb = Math.min(b, cx + hw);
        if (xa > xb) continue;
        const rise = shopRise(j, ri), top = yw + P(units[j].dhPx), halfD = (zb - za) / 2;
        roofY = Math.max(roofY, top + rise);
        for (const x of [xa, xb]) for (const z of [cz - hd, cz + hd]) {
          let slope = Math.min((z - za) / halfD, (zb - z) / halfD);
          if (j === 0 && lc) slope = Math.min(slope, (x - a) / lc, (x - a + zb - lc - z) / halfD);
          if (j === units.length - 1 && rc) slope = Math.min(slope, (b - x) / rc, (b - x + zb - rc - z) / halfD);
          roofMin = Math.min(roofMin, top + rise * clamp(slope, 0, 1));
        }
      }
    } else if (!vict) {
      const rise = P(f.rows[ri].risePx);
      roofY = yw + rise; roofMin = yw + rise * Math.max(0, 1 - hd / ((zb - za) / 2));
    }
    const base = vict ? yw : roofMin - .012;
    const top = roofY + (vict ? .095 : .10), wall = shade(units[ui].wall, -12);
    D.box(cx - hw, cz - hd, cx + hw, cz + hd, base, top, C(wall), C('#b8a08b'), null);
    const pair = hw > .035, pr = Math.min(.016, hw * (pair ? .26 : .50), hd * .60), ph = vict ? .040 : .045;
    if (pair) { pot(D, cx - hw * .50, cz, top, pr, ph); pot(D, cx + hw * .50, cz, top, pr, ph); part('chimneyPot', 2); }
    else { pot(D, cx, cz, top, pr, ph); part('chimneyPot'); }
    part('chimney');
  }
  // 有界前庭：直通每户门的人行步道；绿篱、花圃只在门的另一侧，半独立车道不封口。
  if (!shop && margin > .04) {
    const pathEnd = bk.z + bk.h - (roads.front ? Math.min(.045, margin * .20) : 0);
    // 路只接到街區的一部分時，平貼地界內的橫向步道仍把所有戶門接到同一段人行道。
    if (roads.front) { slab(D, x0, pathEnd, x1, bk.z + bk.h, y0 + .003, '#b8b09b'); counts.props++; part('frontagePath'); }
    for (let i = 0; i < units.length; i++) {
      const a = U(units[i].u0), b = U(units[i].u1), uw = b - a, dc = doors[i], pw = Math.min(.09, uw * .21);
      slab(D, dc - pw / 2, z1, dc + pw / 2, pathEnd, y0 + .003, '#b8b09b'); part('frontPath'); counts.props++;
      const leftOfDoor = dc > (a + b) / 2, ga = leftOfDoor ? a + uw * .07 : dc + pw * .76, gb = leftOfDoor ? dc - pw * .76 : b - uw * .07;
      if (gb - ga > .06 && margin > .085) {
        const bedZ = z1 + margin * .53, bd = Math.min(.02, margin * .10), clearance = Math.min(.01, margin * .025);
        // 綠籬整個厚度都在花圃與橫向步道之間；兩端各留空，不只檢查中心點。
        const th = Math.min(.015, margin * (roads.front ? .05 : .085), (pathEnd - bedZ - bd - 2 * clearance) / 2);
        const hedgeZ = clamp(z1 + margin * (roads.front ? .72 : .84), bedZ + bd + clearance + th, pathEnd - clearance - th);
        D.box(ga, hedgeZ - th, gb, hedgeZ + th, y0, y0 + Math.min(.073, margin * .40), C('#456645'), C('#628055'), null); counts.edges++; part('hedge');
        if (bedZ - bd > z1 + proj + .004) {
          slab(D, ga + .009, bedZ - bd, gb - .009, bedZ + bd, y0 + .010, '#756b48');
          slab(D, ga + .015, bedZ - bd * .53, gb - .015, bedZ + bd * .53, y0 + .020, (i + r.v) % 2 ? '#bd6472' : '#d3b367'); counts.props++; part('flowerbed');
        }
      }
    }
    if (semi) for (let i = 1; i < units.length; i++) if (units[i].u0 - units[i - 1].u1 > 1e-6) {
      slab(D, U(units[i - 1].u1) + .012, bk.z + .015, U(units[i].u0) - .012, pathEnd, y0 + .003, '#99978c'); counts.props++; part('drive');
    }
  }
  // 深地块的第二量体保留原框与高度，不让后门步道穿过它；上面的小设备沿用原计划。
  if (r.ex) {
    const e = r.ex, xa = bk.x + e.box[0] * bk.w, xb = bk.x + e.box[1] * bk.w, za = bk.z + e.box[2] * bk.h, zb = bk.z + e.box[3] * bk.h, top = y0 + P(e.hPx);
    W.box(xa, za, xb, zb, y0, top, C(r.pal.light), C(shade(r.pal.dark, 10)), { floorH: Math.max(.22, P(r.winRowPx * 2)), style: WIN_STYLE.grid, glass: C(r.pal.glass) });
    for (const k of dressing(r).kits) if (k.on === 'ex') {
      const cx = xa + (xb - xa) * k.u, cz = za + (zb - za) * k.v;
      if (k.kind === 'vent') D.box(cx - .015, cz - .015, cx + .015, cz + .015, top, top + .15, C('#9aa1a7'), C('#c3c9ce'), null);
      else if (k.kind === 'ac') D.box(cx - .06, cz - .04, cx + .06, cz + .04, top, top + .07, C('#b9c0c6'), C('#dfe4e8'), null);
      else if (k.kind === 'stair') D.box(cx - .09, cz - .07, cx + .09, cz + .07, top, top + .17, C(shade(r.pal.dark, 14)), C(shade(r.pal.light, 10)), null);
      else D.box(cx - .065, cz - .065, cx + .065, cz + .065, top, top + .24, C('#8a8272'), C('#b0a692'), null);
      counts.kits++;
    }
  }
  // 不加大树遮住窄前庭的门，也不把旧的随机树位搬到新步道上。既有街树由场景层保留。
  void trees;
  const anchorUnit = units[Math.floor(units.length / 2)], [anchorZa, anchorZb] = rowZ(lastRow);
  return new THREE.Vector3(U((anchorUnit.u0 + anchorUnit.u1) / 2), yw, (anchorZa + anchorZb) / 2);
}
