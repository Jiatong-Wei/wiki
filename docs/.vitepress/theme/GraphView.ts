// 知识图谱纯展示组件：props 进 SVG 出，无路由感知、无副作用。
// 坐标来自 graph-data.ts 的预计算布局，SSR 与客户端逐字节一致。
// compact（侧栏）：viewBox 动态取节点包围盒，星座自动占满可用宽度，
// 半径/线宽按包围盒尺度标定（SVG 长度全是 viewBox 单位，不是 px）。
// hover 高亮为组件内部状态；caption 与点击行为通过 hover/pick 事件上抛宿主。
import { h, ref, defineComponent, type PropType } from 'vue';
import { withBase } from 'vitepress';
import { GRAPH_NODES, GRAPH_EDGES, GRAPH_LAYOUT, GRAPH_SIZE, REL_LABEL, STATE_LABEL } from '../graph-data';
import type { GraphNode } from '../graph-data';

export const GraphView = defineComponent({
  name: 'GraphView',
  props: {
    compact: { type: Boolean, default: false },        // 侧栏迷你：bbox 视窗
    labelMode: { type: String as PropType<'all' | 'ids' | 'none'>, default: 'none' },
    labelIds: { type: Array as PropType<string[]>, default: () => [] },
    animate: { type: Boolean, default: false },        // 入场生长动画（每会话一次）
  },
  emits: ['hover', 'pick'],
  setup(props, { emit }) {
    const hovered = ref<string | null>(null);
    const { w, h: vh } = GRAPH_SIZE;

    // 包围盒视窗（compact）：留 40 单位呼吸边，viewBox 随图谱生长自动扩张
    let vx0 = 0, vy0 = 0, vw = w, vhh = vh;
    if (props.compact) {
      const xs = GRAPH_NODES.map((n) => GRAPH_LAYOUT[n.id].x);
      const ys = GRAPH_NODES.map((n) => GRAPH_LAYOUT[n.id].y);
      const pad = 40;
      vx0 = Math.min(...xs) - pad;
      vy0 = Math.min(...ys) - pad;
      vw = Math.max(...xs) + pad - vx0;
      vhh = Math.max(...ys) + pad - vy0;
    }
    const S = props.compact
      ? { r: 9, hit: 26, label: 22, labelGap: 20, edge: 2.8, queuedSW: 3, focusSW: 3.2 }
      : { r: 7, hit: 18, label: 15, labelGap: 13, edge: 1.6, queuedSW: 2.2, focusSW: 2.6 };

    const renderEdge = (e: (typeof GRAPH_EDGES)[number], i: number) => {
      const A = GRAPH_LAYOUT[e.a], B = GRAPH_LAYOUT[e.b];
      if (!A || !B) return null;
      const on = hovered.value !== null && (hovered.value === e.a || hovered.value === e.b);
      const dim = hovered.value !== null && !on;
      const cls = ['gv-edge', on ? 'gv-edge-on' : '', dim ? 'gv-dim' : ''];
      if (props.animate) cls.push('gv-anim-edge');
      return h('line', {
        key: `${e.a}-${e.b}`,
        x1: A.x, y1: A.y, x2: B.x, y2: B.y,
        pathLength: 100, // 动画 dasharray 与边长解耦
        class: cls,
        'stroke-width': on ? S.edge + 0.8 : S.edge,
        style: props.animate ? { animationDelay: `${i * 45}ms` } : undefined,
      });
    };

    const renderNode = (n: GraphNode, i: number) => {
      const p = GRAPH_LAYOUT[n.id];
      if (!p) return null;
      const isHover = hovered.value === n.id;
      const dim = hovered.value !== null && !isHover;
      const showLabel =
        props.labelMode === 'all' ||
        (props.labelMode === 'ids' && props.labelIds.includes(n.id));
      const anim = props.animate ? { animationDelay: `${i * 45}ms` } : undefined;
      const halfLab = props.compact && showLabel ? (n.label.length * S.label * 0.6) / 2 : 0;
      const circle = h('circle', {
        cx: p.x, cy: p.y, r: isHover ? S.r + 2 : S.r,
        class: ['gv-node', `gv-${n.state}`, isHover ? 'gv-node-on' : '', dim ? 'gv-dim' : ''],
        'stroke-width': n.state === 'queued' ? (isHover ? S.focusSW : S.queuedSW) : isHover ? S.focusSW : 0,
      });
      const hit = h('circle', {
        cx: p.x, cy: p.y, r: S.hit, class: 'gv-hit',
        onMouseenter: () => { hovered.value = n.id; emit('hover', n); },
        onMouseleave: () => { hovered.value = null; emit('hover', null); },
        onClick: () => emit('pick', n),
      });
      const label = showLabel
        ? h('text', {
            // clamp 按标签实际半宽算，固定边距会把长标签（如 3D Gaussian Splatting）裁出视窗
            x: Math.max(vx0 + halfLab + 4, Math.min(vx0 + vw - halfLab - 4, p.x)),
            y: p.y + S.labelGap,
            class: ['gv-label', isHover ? 'gv-label-on' : '', dim ? 'gv-dim' : ''],
            'text-anchor': 'middle',
            'font-size': S.label,
            style: anim,
          }, n.label)
        : null;
      const inner: ReturnType<typeof h>[] = [circle];
      if (label) inner.push(label);
      inner.push(hit);
      return h('g', { key: n.id, class: props.animate ? 'gv-anim' : '', style: anim }, [
        n.state === 'written' && n.article
          ? h('a', { href: withBase(n.article) }, inner)
          : inner,
      ]);
    };

    return () =>
      h('svg', {
        viewBox: `${vx0} ${vy0} ${vw} ${vhh}`,
        class: ['gv-svg', props.compact ? 'gv-compact' : ''],
        role: 'img',
        'aria-label': '双链知识图谱星图：coral 实心为已写文章，灰实心为已读，空心为待读',
      }, [
        h('title', {}, '知识图谱'),
        ...GRAPH_EDGES.map(renderEdge).filter(Boolean),
        ...GRAPH_NODES.map((n, i) => renderNode(n, i)),
      ]);
  },
});

// caption 文案：宿主（侧栏 / 全图页）共享
export const captionFor = (n: GraphNode, centerId?: string): string => {
  const parts = [STATE_LABEL[n.state]];
  if (centerId) {
    const center = GRAPH_NODES.find((x) => x.id === centerId);
    const e = GRAPH_EDGES.find(
      (x) => (x.a === n.id && x.b === centerId) || (x.b === n.id && x.a === centerId),
    );
    if (e && center) parts.push(`与「${center.label}」${REL_LABEL[e.rel]}`);
  }
  return n.note ? `${parts.join(' · ')} — ${n.note}` : parts.join(' · ');
};
