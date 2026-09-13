// ============================================================
// 知识图谱数据层 —— 入选协议（冻结；改协议先改这段注释）
//
// 进图：独立发表的工作/模型（paper、model）与范式级概念（concept）
// 不进：loss 设计（Focal/Dice/KL/set-matching/CVAE）、benchmark（LIBERO/CALVIN）、
//       硬件（xArm6）、数据规模（942 条）——细节活在文章里，不做节点
//
// state 三态：queued = 待读（读 PALM 衍生出的未知）；read = 已读/上手过；
//             written = 已写成 wiki 文章（此时 article 必填）
//             state 管"读到哪了"，article 管"写没写"，两者独立演变
//
// rel 三种（读者视角动词，只进 tooltip 与图例，不做视觉编码）：
//   builds-on = 先读 · uses = 用到 · sibling = 同台
//   边方向：a builds-on b ⇒ b 是 a 的地基；a uses b ⇒ a 调用 b
//
// 布局：固定种子力导向在模块加载时预计算（SSR 与浏览器逐字节一致），
//       运行时零模拟。加节点/边只需改下面两张表，坐标自动重排。
// ============================================================

export type GraphKind = 'paper' | 'model' | 'concept';
export type GraphState = 'queued' | 'read' | 'written';
export type GraphRel = 'builds-on' | 'uses' | 'sibling';

export interface GraphNode {
  id: string;
  label: string;   // 全名（全图页 / tooltip）
  short: string;   // 短名（侧栏 hover caption）
  kind: GraphKind;
  state: GraphState;
  article?: string; // wiki 内链（不含 base）
  year?: number;
  note: string;    // 一句话简介（hover caption）
}

export interface GraphEdge {
  a: string; // rel 的主语
  b: string; // rel 的宾语
  rel: GraphRel;
}

export const GRAPH_NODES: GraphNode[] = [
  { id: 'palm', label: 'PALM', short: 'PALM', kind: 'paper', state: 'written', article: '/palm/', year: 2026,
    note: '本文主角 · Progress-Aware Policy Learning via Affordance Reasoning · 68M 打 7B · LIBERO-LONG 91.8%' },
  { id: 'vla', label: 'VLA', short: 'VLA', kind: 'concept', state: 'read',
    note: '视觉-语言-动作模型 · 长程失忆的宿主' },
  { id: 'bc', label: 'Behavior Cloning', short: 'BC', kind: 'concept', state: 'read',
    note: '模仿学习的根 · 状态混叠与多峰性之源' },
  { id: 'gpt2', label: 'GPT-2', short: 'GPT-2', kind: 'model', state: 'read', year: 2019,
    note: 'progress 头的架构底座 · 文中预告单开一篇' },
  { id: 'mlp', label: 'MLP', short: 'MLP', kind: 'concept', state: 'read',
    note: 'affordance 头的基础件 · 文中预告单开一篇' },
  { id: 'diffusion', label: 'Diffusion', short: 'Diffusion', kind: 'concept', state: 'read',
    note: '生成式建模 · 学整个条件分布，天然厌恶点估计' },
  { id: 'gdino', label: 'Grounding DINO', short: 'G-DINO', kind: 'model', state: 'queued', year: 2023,
    note: '开放集目标检测 · Global 标签教师' },
  { id: 'clip', label: 'CLIP', short: 'CLIP', kind: 'model', state: 'read', year: 2021,
    note: '冻结特征提取 · Global 管线的特征底座' },
  { id: 'sam', label: 'SAM', short: 'SAM', kind: 'model', state: 'queued', year: 2023,
    note: 'Segment Anything · 实例 mask 分割' },
  { id: 'glover2', label: 'GLOVER++', short: 'GLOVER++', kind: 'paper', state: 'queued', year: 2025,
    note: 'CoRL 2025 · 梁俊卫组 · Local 接触点高斯热图' },
  { id: 'spatialvlm', label: 'SpatialVLM', short: 'S-VLM', kind: 'paper', state: 'queued', year: 2024,
    note: '空间推理 VLM · 输出 2D 可行点' },
  { id: 'robopoint', label: 'RoboPoint', short: 'RoboPoint', kind: 'model', state: 'queued', year: 2024,
    note: '2D 可行点 → 3D 点云升格' },
  { id: 'cotracker', label: 'CoTracker', short: 'CoTrack', kind: 'model', state: 'queued', year: 2023,
    note: 'Transformer 点跟踪 · Dynamic 运动区域 mask' },
  { id: 'openvla', label: 'OpenVLA', short: 'OpenVLA', kind: 'model', state: 'read', year: 2024,
    note: '7B · LIBERO-LONG 53.7% · 同台 100 倍体量' },
  { id: 'octo', label: 'Octo', short: 'Octo', kind: 'model', state: 'queued', year: 2024,
    note: '通用机器人策略 · LIBERO-LONG 51.1%' },
  { id: 'pi0', label: 'π₀', short: 'π₀', kind: 'model', state: 'queued', year: 2024,
    note: 'CALVIN ABC→D 3.92 · 同台' },
  { id: 'rt1', label: 'RT-1', short: 'RT-1', kind: 'model', state: 'queued', year: 2022,
    note: 'CALVIN 0.90 · 同台' },
  { id: 'seer', label: 'Seer', short: 'Seer', kind: 'paper', state: 'queued', year: 2024,
    note: 'CALVIN ABC→D 3.98 · 同台最强对照组' },
  { id: 'act', label: 'ACT', short: 'ACT', kind: 'paper', state: 'read', year: 2023,
    note: 'Action Chunk Transformer · 多峰三解法之一' },
  { id: 'diffpolicy', label: 'Diffusion Policy', short: 'D-Policy', kind: 'paper', state: 'read', year: 2023,
    note: '多峰三解法之一 · LIBERO 50.5%' },
  { id: 'flowmatch', label: 'Flow Matching', short: 'FlowMatch', kind: 'concept', state: 'queued',
    note: '多峰三解法之一 · 文中预告漫谈' },
  { id: 'nerf', label: 'NeRF', short: 'NeRF', kind: 'paper', state: 'read', year: 2020,
    note: '可微渲染 + 多视角监督的开端 · 入坑原点' },
  { id: '3dgs', label: '3D Gaussian Splatting', short: '3DGS', kind: 'paper', state: 'written', article: '/splat/', year: 2023,
    note: '实时辐射场渲染 · 见《高斯泼溅二三事》' },
];

export const GRAPH_EDGES: GraphEdge[] = [
  { a: 'palm', b: 'vla', rel: 'builds-on' },
  { a: 'palm', b: 'gpt2', rel: 'builds-on' },
  { a: 'palm', b: 'diffusion', rel: 'builds-on' },
  { a: 'vla', b: 'bc', rel: 'builds-on' },
  { a: 'palm', b: 'mlp', rel: 'uses' },
  { a: 'palm', b: 'gdino', rel: 'uses' },
  { a: 'palm', b: 'sam', rel: 'uses' },
  { a: 'palm', b: 'glover2', rel: 'uses' },
  { a: 'palm', b: 'spatialvlm', rel: 'uses' },
  { a: 'palm', b: 'robopoint', rel: 'uses' },
  { a: 'palm', b: 'cotracker', rel: 'uses' },
  { a: 'palm', b: 'clip', rel: 'uses' },
  { a: 'diffpolicy', b: 'diffusion', rel: 'builds-on' },
  { a: 'palm', b: 'openvla', rel: 'sibling' },
  { a: 'palm', b: 'octo', rel: 'sibling' },
  { a: 'palm', b: 'pi0', rel: 'sibling' },
  { a: 'palm', b: 'rt1', rel: 'sibling' },
  { a: 'palm', b: 'seer', rel: 'sibling' },
  { a: 'act', b: 'diffpolicy', rel: 'sibling' },
  { a: 'diffpolicy', b: 'flowmatch', rel: 'sibling' },
  { a: 'nerf', b: '3dgs', rel: 'sibling' },
];

// —— 确定性布局：mulberry32 种子 + 300 轮力导向，模块加载时一次算死 ——
const W = 1000;
const H = 760;

function hash32(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function computeLayout(): Record<string, { x: number; y: number }> {
  const rand = mulberry32(20260913);
  const pos: Record<string, { x: number; y: number }> = {};
  const ids = GRAPH_NODES.map((n) => n.id);
  // 初始：按 id hash 排序铺圆环，避免每次构建顺序差异
  const ordered = [...ids].sort((a, b) => hash32(a) - hash32(b));
  ordered.forEach((id, i) => {
    const ang = (i / ordered.length) * Math.PI * 2;
    pos[id] = { x: W / 2 + Math.cos(ang) * W * 0.3, y: H / 2 + Math.sin(ang) * H * 0.3 };
  });
  const idx = new Map(ids.map((id, i) => [id, i]));
  const deg = new Map(ids.map((id) => [id, 0]));
  for (const e of GRAPH_EDGES) {
    deg.set(e.a, (deg.get(e.a) ?? 0) + 1);
    deg.set(e.b, (deg.get(e.b) ?? 0) + 1);
  }
  const k = Math.sqrt((W * H) / ids.length) * 1.5; // 理想边长：给标签留出呼吸空间
  const disp = ids.map(() => ({ x: 0, y: 0 }));
  for (let iter = 0; iter < 500; iter++) {
    const temp = 80 * (1 - iter / 500) + 2;
    for (const d of disp) { d.x = 0; d.y = 0; }
    // 斥力
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const A = pos[ids[i]], B = pos[ids[j]];
        let dx = A.x - B.x, dy = A.y - B.y;
        let dist2 = dx * dx + dy * dy;
        if (dist2 < 1) { dx = (rand() - 0.5) * 2; dy = (rand() - 0.5) * 2; dist2 = 1; }
        const dist = Math.sqrt(dist2);
        const f = (k * k) / dist2;
        const ux = (dx / dist) * f, uy = (dy / dist) * f;
        disp[i].x += ux; disp[i].y += uy;
        disp[j].x -= ux; disp[j].y -= uy;
      }
    }
    // 引力（沿边）
    for (const e of GRAPH_EDGES) {
      const A = pos[e.a], B = pos[e.b];
      const dx = A.x - B.x, dy = A.y - B.y;
      const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
      const f = (dist * dist) / k;
      const ux = (dx / dist) * f, uy = (dy / dist) * f;
      disp[idx.get(e.a)!].x -= ux; disp[idx.get(e.a)!].y -= uy;
      disp[idx.get(e.b)!].x += ux; disp[idx.get(e.b)!].y += uy;
    }
    // 位移限幅 + 弱重力 + clamp（重力太强会把星座拽成一坨）
    ids.forEach((id, i) => {
      const p = pos[id];
      p.x += Math.max(-temp, Math.min(temp, disp[i].x)) * 0.12 + (W / 2 - p.x) * 0.0012;
      p.y += Math.max(-temp, Math.min(temp, disp[i].y)) * 0.12 + (H / 2 - p.y) * 0.0012;
      const m = 60 + (deg.get(id) ?? 0) * 6;
      p.x = Math.max(m, Math.min(W - m, p.x));
      p.y = Math.max(m + 20, Math.min(H - m - 34, p.y));
    });
  }
  // —— 标签避让：label 近似成矩形（CJK 16.5 单位/字、latin 10.5 + halo 余量），
  // 成对推开。力导向只懂节点不懂标签宽度，不做这一步就出 DINOGPT-2 这种连体婴。
  // 系数故意偏大：Maple Mono 实际 advance ≈0.67em，加 paint-order halo 描边。
  const charW = (ch: string) => (/[\u2e80-\u9fff\u3000-\u303f\uff00-\uffef]/.test(ch) ? 16.5 : 10.5);
  const halfW = new Map(
    ids.map((id) => {
      const n = GRAPH_NODES.find((x) => x.id === id)!;
      return [id, [...n.label].reduce((s, ch) => s + charW(ch), 0) / 2 + 3];
    }),
  );
  const halfH = 18; // 标签画在节点下方 y+13，近似盒高 36
  for (let it = 0; it < 140; it++) {
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const A = pos[ids[i]], B = pos[ids[j]];
        const ax = A.x, ay = A.y + 13, bx = B.x, by = B.y + 13;
        const dx = bx - ax, dy = by - ay;
        const ox = (halfW.get(ids[i]) ?? 40) + (halfW.get(ids[j]) ?? 40) - Math.abs(dx);
        const oy = halfH * 2 - Math.abs(dy);
        if (ox > 0 && oy > 0) {
          if (ox / (halfW.get(ids[i])! + halfW.get(ids[j])!) < oy / (halfH * 2)) {
            const push = (ox / 2 + 3) * (dx < 0 ? -1 : 1);
            A.x -= push; B.x += push;
          } else {
            const push = (oy / 2 + 3) * (dy < 0 ? -1 : 1);
            A.y -= push; B.y += push;
          }
        }
      }
    }
    ids.forEach((id) => {
      const p = pos[id];
      const m = 60 + (deg.get(id) ?? 0) * 6;
      p.x = Math.max(m, Math.min(W - m, p.x));
      p.y = Math.max(m + 20, Math.min(H - m - 34, p.y));
    });
  }
  return pos;
}

export const GRAPH_LAYOUT: Record<string, { x: number; y: number }> = computeLayout();
export const GRAPH_SIZE = { w: W, h: H };

// —— Obsidian 式活体引力：同一物理引擎（斥力 + 边弹簧 + 弱重力）在运行时
//    每帧积分。从 GRAPH_LAYOUT 确定性起点出发微动，SSR 首帧零偏移。
//    startLinkSim 客户端 onMounted 调用；返回句柄的 tick 后必须写回 DOM。——
export interface LinkSimHandle {
  nodes: GraphNode[];
  edges: GraphEdge[];
  pos: Record<string, { x: number; y: number }>;
  vel: Record<string, { x: number; y: number }>;
  pinned: string | null;  // 拖拽中的节点 id：跳过积分不施力
  tick: () => void;
  drift: (id: string, x: number, y: number) => void;
  wake: (id: string) => void;
  strength: number;
}

export function startLinkSim(): LinkSimHandle {
  const ids = GRAPH_NODES.map((n) => n.id);
  const pos: Record<string, { x: number; y: number }> = {};
  const vel: Record<string, { x: number; y: number }> = {};
  for (const id of ids) {
    pos[id] = { ...GRAPH_LAYOUT[id] };
    vel[id] = { x: 0, y: 0 };
  }
  const idx = new Map(ids.map((id, i) => [id, i]));
  const disp = ids.map(() => ({ x: 0, y: 0 }));
  const k = Math.sqrt((W * H) / ids.length) * 1.5;
  let energy = 0.55; // 初始有余温，入画即微动
  let pinned: string | null = null;

  function integrate(dt: number): void {
    if (energy <= 0) return; // 冷却停机：wake/drift 抬 energy 自恢复
    for (const d of disp) { d.x = 0; d.y = 0; }
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const A = pos[ids[i]], B = pos[ids[j]];
        let dx = A.x - B.x, dy = A.y - B.y;
        let dist2 = dx * dx + dy * dy;
        if (dist2 < 1) { dx = 0.1; dy = 0.1; dist2 = 0.02; }
        const dist = Math.sqrt(dist2);
        const f = Math.min((k * k) / dist2, 40);
        disp[i].x += (dx / dist) * f; disp[i].y += (dy / dist) * f;
        disp[j].x -= (dx / dist) * f; disp[j].y -= (dy / dist) * f;
      }
    }
    for (const e of GRAPH_EDGES) {
      const A = pos[e.a], B = pos[e.b];
      const dx = B.x - A.x, dy = B.y - A.y;
      const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
      const f = Math.min((dist - k) * 0.14, 30); // 弹簧到理想边长，不强拉
      const ux = (dx / dist) * f, uy = (dy / dist) * f;
      disp[idx.get(e.a)!].x += ux; disp[idx.get(e.a)!].y += uy;
      disp[idx.get(e.b)!].x -= ux; disp[idx.get(e.b)!].y -= uy;
    }
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];
      if (id === pinned) { vel[id].x = 0; vel[id].y = 0; continue; } // 钉住：不施力不位移
      const p = pos[id], v = vel[id];
      // 弱重力向心 + 冷却阻尼
      disp[i].x += (W / 2 - p.x) * 0.006;
      disp[i].y += (H / 2 - p.y) * 0.006;
      v.x = (v.x + disp[i].x * dt) * 0.86;
      v.y = (v.y + disp[i].y * dt) * 0.86;
      p.x += v.x; p.y += v.y;
      // 钳住，永远不出框
      const m = 70;
      p.x = Math.max(m, Math.min(W - m, p.x));
      p.y = Math.max(m + 14, Math.min(H - m - 24, p.y));
      // 速度归零阈值：冷却后停算
      if (Math.abs(v.x) + Math.abs(v.y) < 0.02) { v.x = 0; v.y = 0; }
    }
    energy = Math.max(0, energy - dt * 0.006);
  }

  return {
    nodes: GRAPH_NODES,
    edges: GRAPH_EDGES,
    pos,
    vel,
    get pinned() { return pinned; },
    set pinned(id: string | null) { pinned = id; },
    tick: () => integrate(1),
    drift: (id, x, y) => {
      const p = pos[id];
      if (!p) return;
      p.x = Math.max(70, Math.min(W - 70, p.x + x));
      p.y = Math.max(84, Math.min(H - 94, p.y + y));
      energy = Math.min(1, energy + 0.35);
    },
    wake: (id) => {
      const v = vel[id];
      if (!v) return;
      v.x += (Math.random() - 0.5) * 6;
      v.y += (Math.random() - 0.5) * 6;
      energy = Math.min(1, energy + 0.5);
    },
    get strength() { return energy; },
  };
}

export const REL_LABEL: Record<GraphRel, string> = {
  'builds-on': '先读',
  'uses': '用到',
  'sibling': '同台',
};

export const STATE_LABEL: Record<GraphState, string> = {
  'queued': '待读',
  'read': '已读',
  'written': '已写',
};

export const nodeById = (id: string): GraphNode | undefined => GRAPH_NODES.find((n) => n.id === id);
