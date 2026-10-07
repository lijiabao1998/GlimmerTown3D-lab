// D054 presentation-only read model. Existing previewOp remains the sole
// placement/cost authority, including its contextual rectangle protections.
// No commit, resource extraction, cached-world writes, or RNG calls here.
import type { Sim } from '../sim/day.ts';
import { CIVIC_TOOLS, ROAD_TOOLS, gestureOf, toolSize, previewOp, type EditOp, type OpPreview, type EditResult } from '../sim/edit.ts';
import { DOZE_ARM_MS } from '../sim/rules/build.ts';
import { RESOURCE_STOCK, RES_OIL, RES_ORE } from '../sim/rules/resource.ts';
import { pipeComponents, facilityComps, WATER_HOPS472 } from '../sim/rules/sewer.ts';
import { FACILITY_NOTES } from './growthGuide.ts';

const OTHER_TOOLS: Readonly<Record<string, { name: string; use: string; placement: string }>> = {
  zr: { name: '住宅分區', use: '規劃住宅用地', placement: '在空陸地按住框選；相同分區且沒有樹的格子略過。' },
  zc: { name: '商業分區', use: '規劃商業用地', placement: '在空陸地按住框選；相同分區且沒有樹的格子略過。' },
  zi: { name: '工業分區', use: '規劃工業用地', placement: '在空陸地按住框選；相同分區且沒有樹的格子略過。' },
  plant: { name: '發電廠', use: '提供城市電力', placement: '點選未被道路或建築佔用的陸地；注意周邊污染。' },
  doze: { name: '拆除', use: '移除現有建設或清理地面', placement: '按住框選；二級以上住商工建築需單格再次確認，框選會略過。' },
};

export function selectedToolGuide(tool: string) {
  const civic = CIVIC_TOOLS.find(t => t.id === tool), road = ROAD_TOOLS.find(t => t.id === tool);
  const note = FACILITY_NOTES[tool] ?? OTHER_TOOLS[tool];
  const gesture = gestureOf(tool), size = toolSize(tool);
  return {
    tool, name: civic?.name ?? road?.name ?? OTHER_TOOLS[tool]?.name ?? tool, gesture,
    gestureLabel: gesture === 'line' ? '按住拉線' : gesture === 'rect' ? '按住框選' : '點放',
    unit: gesture === 'line' ? '每格・拉線' : gesture === 'rect' ? '每格・框選' : `${size}×${size}・點放`,
    use: note?.use ?? (road ? '連接城市道路' : ''),
    placement: note?.placement ?? (road ? '按住拉出路線；水上會加計橋梁造價，同級或更高級道路略過。' : '以落點的原有建造預覽為準。'),
  };
}

export interface SiteReason { reason: string; count: number }
export interface SiteCell { x: number; z: number; ok: boolean; cost: number; foot?: boolean; reason?: string }
export interface SiteResource {
  x: number; z: number; kind: 1 | 2; remaining: number; capacity: number;
  exhausted: boolean; legal: boolean; warning: string;
}
export interface SiteDiagnosis {
  day: number; tool: string; name: string; gesture: EditOp['k'];
  selected: number; eligible: number; skipped: number; footprint: number;
  total: number; funds: number; shortfall: number; affordable: boolean; sandbox: boolean;
  fundingNote: string; policy: string; reasons: SiteReason[]; cells: SiteCell[]; resources: SiteResource[];
  groupedDemolition: boolean;
  network?: { touching: number; components: number; note: string };
}

// Use the shortest round-trip Number representation, grouping only its integer
// part. Integer rounding or fixed decimal truncation can hide a real shortfall.
export function formatSiteMoney(value: number): string {
  const text = String(value);
  if (text.includes('e')) return '$' + text;
  const [whole, fraction] = text.split('.');
  return '$' + whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (fraction === undefined ? '' : '.' + fraction);
}

export function diagnoseSite(s: Sim, op: EditOp, providedPreview?: OpPreview): SiteDiagnosis {
  const pv = providedPreview ?? previewOp(s, op), guide = selectedToolGuide(op.tool);
  const reasons: SiteReason[] = [];
  const cells: SiteCell[] = pv.cells.map(c => {
    if (c.ok || c.foot) return { ...c };
    // A mixed preview intentionally omits its top-level reason. Ask the same
    // original preview for this rejected root only, never decide ok/cost again.
    const single = previewOp(s, { ...op, x0: c.x, z0: c.z, x1: c.x, z1: c.z });
    // The original multi-cell doze preview alone adds this contextual refusal.
    // Its rejected cell becomes eligible in a single-cell preview: explain that
    // exclusion without repeating hiBld/canPlace or changing original cell.ok.
    const reason = single.reason ?? (op.tool === 'doze' && op.k === 'rect' && single.count > 0
      ? '二級以上的建築要單獨拆' : pv.reason ?? '此格已被原建造預覽略過');
    const existing = reasons.find(q => q.reason === reason);
    if (existing) existing.count++; else reasons.push({ reason, count: 1 });
    return { ...c, reason };
  });
  const roots = cells.filter(c => !c.foot), selected = roots.length;
  // A root/ref footprint can be cleared by one original doze action. Preview
  // still prices every selected cell; it cannot predict distinct actual actions.
  // This metadata only suppresses an invalid cells-minus-actions comparison.
  const groupedDemolition = op.tool === 'doze' && roots.some(c => {
    const b = s.w.tiles[c.z * s.w.N + c.x].bld;
    return !!b && (!!b.ref || (b.sz ?? 1) > 1);
  });
  const resources: SiteResource[] = [];
  const resourceKind = op.tool === 'oilwell' ? RES_OIL : op.tool === 'mine' ? RES_ORE : 0;
  if (resourceKind) for (const c of roots) {
    const i = c.z * s.w.N + c.x;
    if (s.res.resource[i] !== resourceKind) continue;
    const remaining = Math.max(0, RESOURCE_STOCK - s.res.rdep[i]), exhausted = remaining === 0;
    resources.push({ x: c.x, z: c.z, kind: resourceKind, remaining, capacity: RESOURCE_STOCK,
      exhausted, legal: c.ok, warning: exhausted ? (c.ok ? '資源已耗盡：仍可建，但不再產出。' : '資源已耗盡；此格另有建造阻擋。') : '' });
  }
  let network: SiteDiagnosis['network'];
  if (op.tool === 'sewage' && roots.length) {
    const { comp, n } = pipeComponents(s.w), c = roots[0];
    const touching = facilityComps(s.w, comp, c.z * s.w.N + c.x, toolSize(op.tool)).length;
    network = { touching, components: n, note: (touching ? `目前貼著 ${touching} 個管網；` : '目前未貼著管網；')
      + `鄰水可建與管網服務分開判定。貼管不保證服務，仍需供電與有效管路距離（${WATER_HOPS472}步規則）。` };
  }
  return {
    day: s.day, tool: op.tool, name: guide.name, gesture: op.k,
    selected, eligible: pv.count, skipped: selected - pv.count, footprint: cells.length,
    total: pv.total, funds: s.money, shortfall: Math.max(0, pv.total - s.money), affordable: pv.affordable, sandbox: s.diff === 3,
    fundingNote: s.money < 0 ? '目前資金為負；既有規則下即使 $0 工程也無法施工。' : '',
    policy: op.k === 'line' ? '沿線逐格嘗試；昂貴格資金不足時略過，後面較便宜的格仍可能完成。'
      : op.k === 'rect' ? '矩形先核對總價；不足時整批不施工，二級以上住商工框選拆除另會略過。'
        : '點放一項工程；仍以實際施工結果為準。',
    reasons, cells, resources, network, groupedDemolition,
  };
}

export interface SiteResultDiagnosis {
  day: number; tool: string; name: string; selected: number; eligible: number;
  completed: number; unfinished: number | null; spent: number; reason?: string;
  armed: boolean; protectedSkipped: number; reasons: SiteReason[]; summary: string;
}

// Capture diagnoseSite immediately before commitOp, then pass the real result.
// Completed count and actual charge come only from that result, never preview
// estimates, event length, or funds differences that could include daily income.
export function diagnoseSiteResult(before: SiteDiagnosis, result: EditResult): SiteResultDiagnosis {
  const completed = result.placed, unfinished = before.groupedDemolition ? null : Math.max(0, before.selected - result.placed), spent = result.spent;
  const armed = !!result.armed;
  return {
    day: before.day, tool: before.tool, name: before.name, selected: before.selected, eligible: before.eligible,
    completed, unfinished, spent, reason: result.reason, armed, protectedSkipped: result.skipped ?? 0,
    reasons: before.reasons.map(r => ({ ...r })),
    summary: armed ? `當次進入拆除準備；須在${DOZE_ARM_MS / 1000}秒內再次點同格，逾時重新確認；實扣 ${formatSiteMoney(spent)}`
      : before.groupedDemolition ? `實際拆除 ${completed} 次・實扣 ${formatSiteMoney(spent)}；原選區 ${before.selected} 格（同棟佔地一併處理）`
        : `完成 ${completed}／未完成 ${unfinished}・實扣 ${formatSiteMoney(spent)}`,
  };
}
