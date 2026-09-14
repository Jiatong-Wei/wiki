import DefaultTheme from 'vitepress/theme';
import { h, defineComponent, onMounted, onBeforeUnmount, watch, nextTick, ref, computed } from 'vue';
import { useRoute, useData, withBase } from 'vitepress';
import { useSidebar } from 'vitepress/theme';
import './custom.css';
import { captionFor } from './GraphView';
import { GRAPH_NODES, GRAPH_EDGES, STATE_LABEL, startLinkSim, GRAPH_LAYOUT } from '../graph-data';

// top reading-progress bar
const ProgressBar = defineComponent({
  setup() {
    const onScroll = () => {
      const el = document.getElementById('reading-progress');
      if (!el) return;
      const doc = document.documentElement;
      const total = doc.scrollHeight - doc.clientHeight;
      el.style.width = `${total > 0 ? Math.min(100, (doc.scrollTop / total) * 100) : 0}%`;
    };
    onMounted(() => window.addEventListener('scroll', onScroll, { passive: true }));
    onBeforeUnmount(() => window.removeEventListener('scroll', onScroll));
    return () => h('div', { id: 'reading-progress' });
  },
});

// "日期 · 约 N 分钟读完 · 约 X 字" injected under each doc's H1.
// 字数口径（title tooltip 同步声明）：正文含标题与盾标行，不含代码块、
// MathJax 公式（隐藏 MathML 会被 innerText 双算）、SVG、导语与本文计数行。
// 仅对带 frontmatter.date 的文章页生效（/graph/ /random/ 等工具页跳过）。
const ReadingTime = defineComponent({
  setup() {
    const route = useRoute();
    const { frontmatter } = useData();
    const inject = () => {
      if (!frontmatter.value.date) return;
      const content = document.querySelector('.content-container') ?? document.querySelector('.content');
      const h1 = content?.querySelector('h1');
      if (!content || !h1 || content.querySelector('.reading-time')) return;
      const source = content.querySelector('.vp-doc') ?? content;
      const clone = source.cloneNode(true) as HTMLElement;
      clone
        .querySelectorAll('pre, code, svg, mjx-container, .reading-time, .doc-lede, .header-anchor')
        .forEach((el) => el.remove());
      const text = clone.innerText ?? '';
      const cjk = (text.match(/[\u4e00-\u9fff\u3000-\u303f\uff01-\uff5e]/g) ?? []).length;
      const words = (text.match(/[a-zA-Z0-9]+(?:[-''][a-zA-Z0-9]+)*/g) ?? []).length;
      const count = cjk + words;
      const countStr =
        count >= 10000 ? `${(count / 10000).toFixed(1)} 万字` : `${count.toLocaleString('en-US')} 字`;
      const minutes = Math.max(1, Math.round(cjk / 400 + words / 220));
      const raw = frontmatter.value.date as string | undefined;
      const date = raw ? raw.slice(0, 10) : undefined;
      const tag = document.createElement('p');
      tag.className = 'reading-time';
      tag.textContent = (date ? `${date} · ` : '') + `约 ${minutes} 分钟读完 · ${countStr}`;
      // 认证标随 meta 行（frontmatter.cert 数据驱动；固定 innerHTML 无注入面）
      if ((frontmatter.value.cert as string | undefined) === 'human') {
        tag.innerHTML += ` · <svg class="cert-ico" viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8.4 2.2 C10.2 3.4 11.9 3.7 13 3.4 C12.9 8.4 11.7 11.6 8.2 14 C5 11.9 3.6 9.6 3.1 5.6 C4.9 5.1 6.8 3.9 8.4 2.2 Z" stroke-width="1.4"/><path d="M6.1 8.4 7.7 10 10.9 6.6" stroke-width="1.4"/></svg> <strong>Human certified</strong> — Handcrafted by Joye`;
      }
      tag.title = '字数口径：正文含标题，不含代码、公式与导语';
      h1.after(tag);
    };
    onMounted(async () => {
      await nextTick();
      inject();
      watch(() => route.path, async () => {
        await nextTick();
        inject();
      });
    });
    return () => null;
  },
});

// image lightbox: click an image to zoom, esc / click to close
// linked images (<a><img>) navigate instead — zooming a CSS-cropped img would
// squeeze the full frame into the cropped box, so those opt out via the link
const ZOOM_SELECTOR = '.content img:not(a img)';
const ZoomImages = defineComponent({
  setup() {
    const route = useRoute();
    let attached = false;
    const apply = async () => {
      if (attached) return;
      attached = true;
      // dynamic import keeps the browser-only lib out of the SSR graph
      const { default: mediumZoom } = await import('medium-zoom');
      const zoom = mediumZoom(ZOOM_SELECTOR, { background: 'var(--vp-c-bg)' });
      const reattach = () => zoom.attach([...document.querySelectorAll(ZOOM_SELECTOR)]);
      reattach();
      watch(() => route.path, async () => {
        await nextTick();
        reattach();
      });
    };
    onMounted(apply);
    return () => null;
  },
});

// navbar title: "Joye's" stays serif, "Wiki" flips to Maple Mono cursive —
// the iPhone-welcome-page mixed-typeface greeting. VitePress renders the
// title as plain text from config, so we restyle the DOM once after mount.
const BrandTitle = defineComponent({
  setup() {
    const route = useRoute();
    const apply = () => {
      document
        .querySelectorAll('.VPNavBarTitle .title, .VPNavScreen .site-name')
        .forEach((el) => {
          const host = el as HTMLElement;
          if (host.dataset.brandSplit === '1') return;
          host.dataset.brandSplit = '1';
          if (!host.textContent?.includes("Joye's")) return;
          host.innerHTML = `Joye's <em class="nb-cursive">Wiki</em>`;
        });
    };
    onMounted(async () => {
      await nextTick();
      apply();
      watch(() => route.path, async () => {
        await nextTick();
        apply();
      });
    });
    return () => null;
  },
});

// "手气不错" random-pick: the hero brand button links to /random/, which is
// a real page (no-JS fallback). With JS, this capture-phase listener picks a
// random article among the homepage feature-card links and navigates there.
const RandomPick = defineComponent({
  setup() {
    if (typeof window === 'undefined') return () => null;
    window.addEventListener('click', (e) => {
      const anchor = (e.target as HTMLElement)?.closest?.('a');
      if (!anchor || !anchor.getAttribute('href')?.endsWith('/random/')) return;
      e.preventDefault();
      const pool = [...document.querySelectorAll('.VPFeature.link')]
        .map((card) => (card as HTMLAnchorElement).getAttribute('href'))
        .filter((h): h is string => !!h);
      const target = pool.length
        ? pool[Math.floor(Math.random() * pool.length)]
        : '/splat/';
      window.location.assign(target);
    }, true);
    return () => null;
  },
});

// article lede: frontmatter.summary rendered between H1 and the meta line.
// Registered AFTER ReadingTime so insertion order lands h1 -> lede -> meta.
const Lede = defineComponent({
  setup() {
    const route = useRoute();
    const { frontmatter } = useData();
    const inject = () => {
      const content = document.querySelector('.content-container') ?? document.querySelector('.content');
      const h1 = content?.querySelector('h1');
      if (!content || !h1 || content.querySelector('.doc-lede')) return;
      const summary = frontmatter.value.summary as string | undefined;
      if (!summary) return;
      const p = document.createElement('p');
      p.className = 'doc-lede';
      p.textContent = summary;
      h1.after(p);
    };
    onMounted(async () => {
      await nextTick();
      inject();
      watch(() => route.path, async () => { await nextTick(); inject(); });
    });
    return () => null;
  },
});

// graph侧栏挂载（本页目录正下方）：当前文章高亮，活体引力微动
//（Obsidian 双链式：从确定性布局出发持续积分，hover 扰动会摇醒邻居）。
// hover 出一句话简介，coral 实心（written）节点可点进文章。
// /graph/ /random/ 等工具页与无图节点的文章不渲染。
const GraphAside = defineComponent({
  setup() {
    const route = useRoute();
    const caption = ref('');
    const animate = ref(false);
    const hoveredId = ref<string | null>(null);
    const tickId = ref(0); // 驱动 SVG 重渲染的 tick（rAF 写入）
    const excluded = computed(() => ['/graph/', '/random/'].some((p) => route.path.includes(p)));
    const center = computed(() => {
      const path = route.path.replace(/\/$/, '');
      return (
        GRAPH_NODES.find((n) => n.article && path === withBase(n.article).replace(/\/$/, '')) ??
        null
      );
    });

    // 极简 hover 文案：只显工作名 + 与当前文章的关系（用户点单：不要长描述）
    const shortRel = (n: any, center: any): string => {
      const e = GRAPH_EDGES.find(
        (x) => (x.a === n.id && x.b === center.id) || (x.b === n.id && x.a === center.id),
      );
      if (!e) return n.label;
      const L: Record<string, string> = {
        'uses-c': `${center.label} 用到它`, 'uses-n': `它用到 ${center.label}`,
        'builds-on-c': `${center.label} 建立在它之上`, 'builds-on-n': `它是 ${center.label} 的地基`,
        'sibling': `与 ${center.label} 同台`,
      };
      if (e.rel === 'sibling') return `${n.label} · ${L.sibling}`;
      const key = e.rel + (e.a === center.id ? '-c' : '-n');
      return `${n.label} · ${L[key] ?? ''}`;
    };

    let sim: ReturnType<typeof startLinkSim> | null = null;
    let raf = 0;
    const simReady = ref(false);
    const layoutBusyRef = ref(false); // render 响应式：layout-animating 类挂/摘
    // 缩放视窗：滚轮 zoom-at-point，zoom≥1.5 自动展开全部工作名。
    // 普通对象非响应式——渲染只走 pendingRender→tickId 管线（K3 P1-1）
    const view = { zoom: 1, cx: 0, cy: 0 };
    // fixed 浮层几何：SVG 脱离侧栏的 overflow 裁切，向右下发展。
    // 左界锚 aside-container 左缘（硬钳防布局未稳期漂移），右界钳视口，
    // 高度参与公式（slice 模式星图纵向放大）。
    const floatBox = ref<{ left: number; top: number; width: number; height: number } | null>(null);
    const boxView = ref<{ vx0: number; vy0: number; vw: number; vhh: number } | null>(null);
    let holderEl: HTMLElement | null = null;
    let asideEl: HTMLElement | null = null;
    let clsObsRef: MutationObserver | null = null;
    let dragId: string | null = null;
    let dragMoved = false;
    let dragStart = { x: 0, y: 0 };
    let svgEl: SVGSVGElement | null = null;
    // 空白平移：按下非节点处拖动 = pan 视窗（长按拖动看别处）
    let pan: { cx: number; cy: number; gx: number; gy: number } | null = null;
    // 掉帧治本：鼠标事件只置 pending，渲染统一由 rAF loop 消费（≤60fps）
    let pendingRender = false;
    const requestRender = () => { pendingRender = true; };
    const clientToGraph = (ev: MouseEvent | TouchEvent): { x: number; y: number } | null => {
      if (!svgEl) return null;
      const rect = svgEl.getBoundingClientRect();
      // 实时 viewBox（缩放后依然精确）；档位判定沿用 fb/boxView
      const raw = svgEl.getAttribute('viewBox');
      if (!raw) return null;
      const [vx0r, vy0r, vwr, vhr] = raw.split(/\s+/).map(Number);
      const fb = floatBox.value;
      if (!fb) return null;
      const vb = { vx0: vx0r, vy0: vy0r, vw: vwr, vhh: vhr };
      // 档位感知换算（K3 P1-1）：slice=max+xMid+yMin（y 顶对齐）；meet=min+双轴居中。
      // 档位判定与 render 的 par 一致
      const sliceMode = fb.height >= fb.width * 0.876;
      const scale = sliceMode
        ? Math.max(rect.width / vb.vw, rect.height / vb.vhh)
        : Math.min(rect.width / vb.vw, rect.height / vb.vhh);
      const offX = (vb.vw - rect.width / scale) / 2; // xMid 两档都居中
      const offY = sliceMode ? 0 : (vb.vhh - rect.height / scale) / 2;
      return {
        x: vb.vx0 + offX + (('touches' in ev ? ev.touches[0].clientX : ev.clientX) - rect.left) / scale,
        y: vb.vy0 + offY + (('touches' in ev ? ev.touches[0].clientY : ev.clientY) - rect.top) / scale,
      };
    };
    const onMove = (ev: MouseEvent | TouchEvent) => {
      if (pan && !dragId && svgEl) {
        // pan：client 位移换算图单位，反向移动视窗中心
        const rect = svgEl.getBoundingClientRect();
        const raw = svgEl.getAttribute('viewBox');
        if (raw) {
          const [vx0r, vy0r, vwr] = raw.split(/\s+/).map(Number);
          const scale = rect.width / vwr;
          const cxp = 'touches' in ev ? ev.touches[0].clientX : ev.clientX;
          const cyp = 'touches' in ev ? ev.touches[0].clientY : ev.clientY;
          const gx = vx0r + (cxp - rect.left) / scale;
          const gy = vy0r + (cyp - rect.top) / scale;
          view.cx = pan.cx - (gx - pan.gx);
          view.cy = pan.cy - (gy - pan.gy);
          requestRender();
        }
        if ('touches' in ev) ev.preventDefault();
        return;
      }
      if (!dragId || !sim) return;
      const g = clientToGraph(ev);
      if (!g) return;
      if (!dragMoved && Math.hypot(g.x - dragStart.x, g.y - dragStart.y) > 6) dragMoved = true;
      // 钳进冻结视窗（内缩 30）：拖拽可越出浮层但节点不出窗消失（K3 P1-2）
      const bv = boxView.value;
      if (bv) {
        g.x = Math.max(bv.vx0 + 30, Math.min(bv.vx0 + bv.vw - 30, g.x));
        g.y = Math.max(bv.vy0 + 30, Math.min(bv.vy0 + bv.vhh - 30, g.y));
      }
      sim.pos[dragId].x = g.x;
      sim.pos[dragId].y = g.y;
      // 拖拽中不每帧 wake（闪烁源）；邻居联动靠 mousedown 时一次 wake
      requestRender(); // rAF 消费：鼠标 125Hz 不再逐事件全量渲染
      if ('touches' in ev) ev.preventDefault();
    };
    const onUp = () => {
      dragId = null;
      pan = null;
      if (sim) sim.pinned = null;
      requestRender(); // 松手终态确保渲染
      setTimeout(() => { dragMoved = false; }, 0);
    };
    // 滚轮缩放：以光标为锚 zoom-at-point；无需跳全图页看局部/整体
    const onWheel = (ev: WheelEvent) => {
      if (!svgEl || !ev.deltaY) return; // P2-2：触控板横向滑 deltaY=0 不缩放
      ev.preventDefault();
      const f = ev.deltaY < 0 ? 1.14 : 1 / 1.14;
      const v = view;
      const nz = Math.max(0.45, Math.min(3, v.zoom * f));
      const anchor = clientToGraph(ev);
      if (anchor) {
        // 锚点守恒：(a-c')·z' = (a-c)·z ⇒ k = 旧/新（K3 P0-1：写反成新/旧会逐 tick 外漂）
        const k = v.zoom / nz;
        v.cx = anchor.x - (anchor.x - v.cx) * k;
        v.cy = anchor.y - (anchor.y - v.cy) * k;
      }
      v.zoom = nz;
      requestRender();
    };
    const place = () => {
      if (!holderEl) return;
      const aside = document.querySelector('.aside-container') as HTMLElement | null;
      const hr = holderEl.getBoundingClientRect();
      const ar = aside?.getBoundingClientRect();
      // 左界：aside 左缘（比 holder 稳，水合早期 holder 可能漂）
      const left = Math.max(Math.round(ar?.left ?? hr.left), Math.round(hr.left) - 4);
      // 右界：视口右缘留 14px；宽度 cap 侧栏宽的 1.85 倍
      const width = Math.max(200, Math.min(Math.round((ar?.width ?? hr.width) * 1.85), window.innerWidth - left - 14));
      // 下界发展：高度吃掉视口剩余（cap 宽的 0.98，slice 会纵向放大星图）
      const height = Math.min(window.innerHeight - hr.top - 14, Math.round(width * 0.98));
      floatBox.value = { left, top: Math.round(hr.top), width, height: Math.max(160, height) };
    };
    onMounted(() => {
      try {
        if (!sessionStorage.getItem('graph-grew')) {
          animate.value = true;
          sessionStorage.setItem('graph-grew', '1');
        }
      } catch { /* 存储被禁用时静默降级 */ }
      sim = startLinkSim();
      simReady.value = true; // ref 触发重渲染，不靠裸变量时机
      nextTick(place);
      window.addEventListener('resize', place);
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
      window.addEventListener('touchmove', onMove, { passive: false });
      window.addEventListener('touchend', onUp);
      // aside 是 fixed + 自身滚动：长目录把 widget 顶出视口后，内部滚动也移动 holder（K3 P1-1）
      asideEl = document.querySelector('.aside-container');
      asideEl?.addEventListener('scroll', place, { passive: true });
      // render 响应式让路：layout-animating 类切换时同步 ref（classList 读取本身不触发重渲染）
      const clsObs = new MutationObserver(() => {
        layoutBusyRef.value = document.documentElement.classList.contains('layout-animating');
      });
      clsObs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
      clsObsRef = clsObs; // 局部变量防泄漏
      const layoutBusy = () => document.documentElement.classList.contains('layout-animating');
      let wasBusy = false;
      const loop = () => {
        const busy = layoutBusy();
        if (sim && !busy) {
          if (wasBusy) place(); // 过渡结束下降沿：aside 已平移，重锚浮层（K3 P0-2 双保险）
          sim.tick();
          // 空闲门：能量归零且无交互时不推帧；交互期 pending 由这里统一消费（≤60fps）
          if (pendingRender || sim.strength > 0 || hoveredId.value || dragId) {
            pendingRender = false;
            tickId.value++;
          }
        }
        wasBusy = busy;
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
      watch(() => route.path, () => {
        animate.value = false;
        caption.value = '';
        hoveredId.value = null; // 跨路由清 hover 残留
        view.zoom = 1; view.cx = 0; view.cy = 0; // K3 P1-1：重置缩放，新文章中心不缺位
        nextTick(place); // 路由切换后 aside 位置可能变，重锚浮层
      });
    });
    onBeforeUnmount(() => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', place);
      clsObsRef?.disconnect();
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onUp);
      asideEl?.removeEventListener('scroll', place);
    });

    return () => {
      const c = center.value;
      if (!c || excluded.value) return null;
      if (!simReady.value || !sim) return h('div', { class: 'graph-widget' }, [
        h('div', { class: 'graph-widget-head' }, [
          h('span', { class: 'graph-widget-title' }, 'graph'),
          h('a', { class: 'graph-widget-link', href: withBase('/graph/') }, '全图 →'),
        ]),
      ]);
      tickId.value; // 订阅重渲染（rAF 驱动）
      const nodes = sim.nodes;
      const edges = sim.edges;
      const pos = sim.pos;
      // compact 视窗冻结在确定性布局 bbox：漂移后不重算（动态视窗随节点抖动，
      // 观感是"节点忽隐忽现"）；pad 60 给漂移留余量，出窗节点可拖回
      if (!boxView.value) {
        const xs = nodes.map((n) => GRAPH_LAYOUT[n.id]?.x ?? pos[n.id].x);
        const ys = nodes.map((n) => GRAPH_LAYOUT[n.id]?.y ?? pos[n.id].y);
        const pad = 60;
        const bx0 = Math.min(...xs) - pad, by0 = Math.min(...ys) - pad;
        const bv = { vx0: bx0, vy0: by0, vw: Math.max(...xs) + pad - bx0, vhh: Math.max(...ys) + pad - by0 };
        boxView.value = bv;
        view.cx = bv.vx0 + bv.vw / 2; view.cy = bv.vy0 + bv.vhh / 2;
      }
      const { vx0, vy0, vw, vhh } = boxView.value;
      const hid = hoveredId.value;
      const S = { r: 9, label: 24, queuedSW: 3, focusSW: 3.2, edge: 2.8 };

      const renderEdge = (e: any) => {
        const A = pos[e.a], B = pos[e.b];
        const on = hid !== null && (hid === e.a || hid === e.b);
        const dim = hid !== null && !on;
        return h('line', {
          key: `${e.a}-${e.b}`, x1: A.x, y1: A.y, x2: B.x, y2: B.y,
          class: ['gv-edge', on ? 'gv-edge-on' : '', dim ? 'gv-dim' : ''],
          'stroke-width': on ? S.edge + 0.8 : S.edge,
        });
      };
      const renderNode = (n: any) => {
        const p = pos[n.id];
        const isHover = hid === n.id;
        const dim = hid !== null && !isHover;
        const showLabel = n.id === c.id || showAllLabels;
        const labSize = showAllLabels ? 17 : S.label;
        const inner: any[] = [h('circle', {
          cx: p.x, cy: p.y, r: isHover ? S.r + 2 : S.r,
          class: ['gv-node', `gv-${n.state}`, isHover ? 'gv-node-on' : '', dim ? 'gv-dim' : ''],
          'stroke-width': n.state === 'queued' ? (isHover ? S.focusSW : S.queuedSW) : isHover ? S.focusSW : 0,
        })];
        if (showLabel) {
          const halfLab = (n.label.length * labSize * 0.95) / 2; // CJK 实际 ~1.0em/字，0.6 低估 40%（K3 P2）
          inner.push(h('text', {
            x: Math.max(zvx + halfLab + 4, Math.min(zvx + zvw - halfLab - 4, p.x)),
            y: p.y - S.r - 4, // 标签在节点上方：不再盖圆点（用户点单）
            class: ['gv-label', isHover ? 'gv-label-on' : '', dim ? 'gv-dim' : ''],
            'text-anchor': 'middle', 'font-size': labSize,
          }, n.label));
        }
        inner.push(h('circle', {
          cx: p.x, cy: p.y, r: 28, class: 'gv-hit gv-hit-drag',
          onMousedown: (ev: MouseEvent) => {
            dragId = n.id;
            dragMoved = false;
            const g = clientToGraph(ev);
            if (g) dragStart = g;
            if (sim) { sim.pinned = n.id; sim.wake(n.id); } // 抬能量一次：邻居跟上，但拖拽中不再每帧唤醒（闪烁源）
            ev.preventDefault();
          },
          onTouchstart: (ev: TouchEvent) => {
            dragId = n.id;
            dragMoved = false;
            const g = clientToGraph(ev);
            if (g) dragStart = g;
            if (sim) { sim.pinned = n.id; sim.wake(n.id); } // touch 同 mousedown：一次抬能量
          },
          onMouseenter: () => {
            hoveredId.value = n.id;
            caption.value = shortRel(n, c); // 极简：名称 + 与当前文章关系
            sim?.wake(n.id); // 摇醒邻居
          },
          onMouseleave: () => { hoveredId.value = null; caption.value = ''; },
          onClick: (ev: MouseEvent) => {
            if (dragMoved) { ev.preventDefault(); ev.stopPropagation(); return; }
          },
        }));
        return h('g', { key: n.id }, [
          n.state === 'written' && n.article ? h('a', { href: withBase(n.article) }, inner) : inner,
        ]);
      };

      const fb = floatBox.value;
      const busy = layoutBusyRef.value;
      const holderStyle = fb
        ? { width: '100%', height: `${fb.height}px` }
        : { width: '100%', height: '190px' };
      // 占位保高：浮层隐身即可，占位不动——图例在占位下，占位坍缩图例瞬跳
      // slice 纵向放大星图（向下方发展）；高度受限档降级 meet 防裁掉底部节点（K3 P1-2）
      const par = fb && fb.height >= fb.width * 0.876 ? 'xMidYMin slice' : 'xMidYMid meet';
      // 缩放视窗：view.center/zoom 变换冻结 bbox（初始化在 boxView 中心）
      const vv = view;
      const zvx = vv.cx - (vw / 2) / vv.zoom, zvy = vv.cy - (vhh / 2) / vv.zoom;
      const zvw = vw / vv.zoom, zvhh = vhh / vv.zoom;
      // 标签阈值：zoom≥1.12 显全部工作名（一档滚轮即全亮），看全局只留当前文章名
      const showAllLabels = vv.zoom >= 1.12;
      const labelSize = showAllLabels ? 17 : S.label; // 全标签档降字号：避让预算按 ~16.5 估（K3 P2-3）
      const svg = h('svg', {
        ref: (el: any) => { svgEl = el as SVGSVGElement; },
        viewBox: `${zvx} ${zvy} ${zvw} ${zvhh}`, class: 'gv-svg gv-compact',
        preserveAspectRatio: par,
        role: 'img',
        'aria-label': 'graph：coral 实心为已写文章，灰实心为已读，空心为待读；滚轮缩放',
        onWheel: (ev: WheelEvent) => onWheel(ev),
        onMousedown: (ev: MouseEvent) => {
          if (dragId || !svgEl) return; // 节点拖拽由 hit 圆自理；空白处启动平移
          const rect = svgEl.getBoundingClientRect();
          const raw = svgEl.getAttribute('viewBox');
          if (!raw) return;
          const [vx0r, vy0r, vwr] = raw.split(/\s+/).map(Number);
          const scale = rect.width / vwr;
          const cxp = 'touches' in ev ? (ev as unknown as TouchEvent).touches[0].clientX : ev.clientX;
          const cyp = 'touches' in ev ? (ev as unknown as TouchEvent).touches[0].clientY : ev.clientY;
          pan = { cx: view.cx, cy: view.cy, gx: vx0r + (cxp - rect.left) / scale, gy: vy0r + (cyp - rect.top) / scale };
          ev.preventDefault();
        },
      }, [
        h('title', {}, 'graph'),
        ...edges.map(renderEdge).filter(Boolean),
        ...nodes.map(renderNode),
      ]);
      return h('div', { class: ['graph-widget', animate.value ? 'graph-widget-anim' : ''] }, [
        h('div', { class: 'graph-widget-head' }, [
          h('span', { class: 'graph-widget-title' }, 'graph'),
          h('a', { class: 'graph-widget-link', href: withBase('/graph/') }, '全图 →'),
        ]),
        h('div', {
          ref: (el: any) => { holderEl = el as HTMLElement; },
          class: 'graph-float-holder',
          style: holderStyle,
        }),
        fb
          ? h('div', {
              class: ['graph-float', layoutBusyRef.value ? 'graph-float-busy' : ''],
              // height 必须显式：否则 svg 的 100% 解析为 auto，slice 纵向放大落空（K3 P0-1）
              style: `left:${fb.left}px; top:${fb.top}px; width:${fb.width}px; height:${fb.height}px;`,
            }, [svg])
          : null,
        caption.value
          ? h('p', { class: 'graph-widget-caption', 'aria-live': 'polite' }, caption.value)
          : h('div', { class: 'graph-legend graph-legend-aside' }, [
              h('span', { class: 'graph-legend-chip lg-written' }, '已写'),
              h('span', { class: 'graph-legend-chip lg-read' }, '已读'),
              h('span', { class: 'graph-legend-chip lg-queued' }, '待读'),
            ]),
      ]);
    };
  },
});

// 全图页 <GraphFull />（graph.md 内直接用，enhanceApp 全局注册）
// Obsidian 式交互：活体引力 + 拖拽节点 + 悬停邻居聚集。
// 挂载时给 html 打 graph-page 类：隐藏 aside、放宽 content，全图占满版心。
const GraphFull = defineComponent({
  setup() {
    const caption = ref('');
    const hoveredId = ref<string | null>(null);
    const tickId = ref(0);
    // 缩放/平移视窗 + rAF 渲染节流。view 是普通对象（非响应式）：
    // mutate 不触发逐事件渲染，统一走 pendingRender→loop→tickId 管线（K3 P1-1）
    const view = { zoom: 1, cx: 500, cy: 380 };
    let panF: { cx: number; cy: number; gx: number; gy: number } | null = null;
    let pendingRender = false;

    let sim: ReturnType<typeof startLinkSim> | null = null;
    let raf = 0;
    const simReady = ref(false);
    let dragId: string | null = null;
    let dragMoved = false; // 拖拽守卫：位移超阈值才算拖，否则松手算点击
    let dragStart = { x: 0, y: 0 };
    let svgEl: SVGSVGElement | null = null;

    const clientToGraph = (ev: MouseEvent | TouchEvent): { x: number; y: number } | null => {
      if (!svgEl) return null;
      const rect = svgEl.getBoundingClientRect();
      const raw = svgEl.getAttribute('viewBox');
      if (!raw) return null;
      const [vx0, vy0, vw, vh] = raw.split(/\s+/).map(Number);
      const cx = 'touches' in ev ? ev.touches[0].clientX : ev.clientX;
      const cy = 'touches' in ev ? ev.touches[0].clientY : ev.clientY;
      const scale = Math.max(rect.width / vw, rect.height / vh); // 满框 aspect 匹配，max≈min
      const offX = (vw - rect.width / scale) / 2, offY = (vh - rect.height / scale) / 2;
      return { x: vx0 + offX + (cx - rect.left) / scale, y: vy0 + offY + (cy - rect.top) / scale };
    };
    // 滚轮缩放：锚点守恒 k=旧/新；clamp 0.45~3
    const onWheelF = (ev: WheelEvent) => {
      if (!svgEl || !ev.deltaY) return;
      ev.preventDefault();
      const f = ev.deltaY < 0 ? 1.14 : 1 / 1.14;
      const v = view;
      const nz = Math.max(0.45, Math.min(3, v.zoom * f));
      const anchor = clientToGraph(ev);
      if (anchor) {
        const k = v.zoom / nz;
        v.cx = anchor.x - (anchor.x - v.cx) * k;
        v.cy = anchor.y - (anchor.y - v.cy) * k;
      }
      v.zoom = nz;
      pendingRender = true;
    };
    const onMove = (ev: MouseEvent | TouchEvent) => {
      if (panF && !dragId && svgEl) {
        // pan：client 位移换算图单位，反向移动视窗中心
        const rect = svgEl.getBoundingClientRect();
        const raw = svgEl.getAttribute('viewBox');
        if (raw) {
          const [vx0r, vy0r, vwr] = raw.split(/\s+/).map(Number);
          const scale = rect.width / vwr;
          const cxp = 'touches' in ev ? ev.touches[0].clientX : ev.clientX;
          const cyp = 'touches' in ev ? ev.touches[0].clientY : ev.clientY;
          view.cx = panF.cx - ((vx0r + (cxp - rect.left) / scale) - panF.gx);
          view.cy = panF.cy - ((vy0r + (cyp - rect.top) / scale) - panF.gy);
          pendingRender = true;
        }
        if ('touches' in ev) ev.preventDefault();
        return;
      }
      if (!dragId || !sim) return;
      const g = clientToGraph(ev);
      if (!g) return;
      const dx = g.x - dragStart.x, dy = g.y - dragStart.y;
      if (!dragMoved && Math.hypot(dx, dy) > 5) dragMoved = true;
      // 钳画布边界内缩：pinned 节点跳过 integrate 的 clamp，这里补（K3 P1-3）
      sim.pos[dragId].x = Math.max(70, Math.min(930, g.x));
      sim.pos[dragId].y = Math.max(84, Math.min(666, g.y));
      // 拖拽中不每帧 wake 邻居；能量低谷低频补热防长拖冻死（K3 P0-1）
      if (sim.strength < 0.15) sim.wake(dragId);
      pendingRender = true;
      if ('touches' in ev) ev.preventDefault();
    };
    const onUp = () => {
      dragId = null;
      panF = null;
      if (sim) sim.pinned = null;
      pendingRender = true;
      // click 守卫：拖拽结束的 click 事件在 setTimeout 后清，避免松手跳链
      setTimeout(() => { dragMoved = false; }, 0);
    };
    onMounted(() => {
      document.documentElement.classList.add('graph-page'); // 全图页占满版心
      sim = startLinkSim();
      simReady.value = true; // 与 GraphAside 同款时机修复：裸闭包变量赋值不触发重渲染
      const layoutBusyF = () => document.documentElement.classList.contains('layout-animating');
      const loop = () => {
        if (sim && !layoutBusyF()) {
          sim.tick();
          // 空闲门 + 交互 pending 统一 rAF 消费（鼠标事件不逐次触发全量渲染）
          if (pendingRender || sim.strength > 0 || hoveredId.value || dragId) {
            pendingRender = false;
            tickId.value++;
          }
        }
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
      window.addEventListener('touchmove', onMove, { passive: false });
      window.addEventListener('touchend', onUp);
    });
    onBeforeUnmount(() => {
      document.documentElement.classList.remove('graph-page'); // 离开全图页恢复版心
      cancelAnimationFrame(raf);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onUp);
    });

    const chip = (cls: string, text: string) =>
      h('span', { class: ['graph-legend-chip', cls] }, text);
    return () => {
      if (!simReady.value || !sim) return null;
      tickId.value;
      const { nodes, edges, pos } = sim;
      const hid = hoveredId.value;
      const S = { r: 7, label: 15, labelGap: 13, queuedSW: 2.2, focusSW: 2.6, edge: 1.6 };

      const fv = view; // 当前视窗（zoom 变换后）
      const fzvx = fv.cx - 500 / fv.zoom, fzvw = 1000 / fv.zoom;
      const renderEdge = (e: any) => {
        const A = pos[e.a], B = pos[e.b];
        const on = hid !== null && (hid === e.a || hid === e.b);
        const dim = hid !== null && !on;
        return h('line', {
          key: `${e.a}-${e.b}`, x1: A.x, y1: A.y, x2: B.x, y2: B.y,
          class: ['gv-edge', on ? 'gv-edge-on' : '', dim ? 'gv-dim' : ''],
          'stroke-width': on ? S.edge + 0.7 : S.edge,
        });
      };
      const renderNode = (n: any) => {
        const p = pos[n.id];
        const isHover = hid === n.id;
        const dim = hid !== null && !isHover;
        const inner: any[] = [h('circle', {
          cx: p.x, cy: p.y, r: isHover ? S.r + 2 : S.r,
          class: ['gv-node', `gv-${n.state}`, isHover ? 'gv-node-on' : '', dim ? 'gv-dim' : ''],
          'stroke-width': n.state === 'queued' ? (isHover ? S.focusSW : S.queuedSW) : isHover ? S.focusSW : 0,
        })];
        const halfLab = (n.label.length * S.label * 0.95) / 2;
        inner.push(h('text', {
          x: Math.max(fzvx + halfLab + 6, Math.min(fzvx + fzvw - halfLab - 6, p.x)),
          y: p.y - S.r - 4,
          class: ['gv-label', isHover ? 'gv-label-on' : '', dim ? 'gv-dim' : ''],
          'text-anchor': 'middle', 'font-size': S.label,
        }, n.label));
        inner.push(h('circle', {
          cx: p.x, cy: p.y, r: 18, class: 'gv-hit gv-hit-drag',
          onMousedown: (ev: MouseEvent) => {
            dragId = n.id;
            dragMoved = false;
            const g = clientToGraph(ev);
            if (g) dragStart = g;
            if (sim) { sim.pinned = n.id; sim.wake(n.id); } // 抬能量一次：邻居跟上，拖拽中不再每帧唤醒
            ev.preventDefault();
          },
          onTouchstart: (ev: TouchEvent) => {
            dragId = n.id;
            dragMoved = false;
            const g = clientToGraph(ev);
            if (g) dragStart = g;
            if (sim) { sim.pinned = n.id; sim.wake(n.id); } // touch 同 mousedown：一次抬能量
          },
          onMouseenter: () => {
            hoveredId.value = n.id;
            caption.value = captionFor(n);
            sim?.wake(n.id);
            for (const e of GRAPH_EDGES) {
              if (e.a === n.id) sim?.wake(e.b);
              if (e.b === n.id) sim?.wake(e.a);
            }
          },
          onMouseleave: () => { hoveredId.value = null; caption.value = ''; },
          onClick: (ev: MouseEvent) => {
            // 拖拽守卫：位移过阈值的松手算拖拽不算点击（K3 P1-3）
            if (dragMoved) { ev.preventDefault(); ev.stopPropagation(); return; }
            if (n.state !== 'written' && !dragId) caption.value = `「${n.label}」${STATE_LABEL[n.state]} — ${n.note}`;
          },
        }));
        return h('g', { key: n.id }, [
          n.state === 'written' && n.article ? h('a', { href: withBase(n.article) }, inner) : inner,
        ]);
      };

      return h('div', { class: 'graph-full' }, [
        h('svg', {
          ref: (el: any) => { svgEl = el; },
          viewBox: `${view.cx - 500 / view.zoom} ${view.cy - 380 / view.zoom} ${1000 / view.zoom} ${760 / view.zoom}`,
          class: 'gv-svg', role: 'img',
          'aria-label': 'graph：coral 实心为已写文章，灰实心为已读，空心为待读；滚轮缩放，空白拖动平移',
          onWheel: (ev: WheelEvent) => onWheelF(ev),
          onMousedown: (ev: MouseEvent) => {
            if (dragId || !svgEl) return; // 节点拖拽自理；空白启动平移
            const g = clientToGraph(ev);
            if (g) panF = { cx: view.cx, cy: view.cy, gx: g.x, gy: g.y };
            ev.preventDefault();
          },
        }, [
          h('title', {}, 'graph'),
          ...edges.map(renderEdge).filter(Boolean),
          ...nodes.map(renderNode),
        ]),
        h('div', { class: 'graph-legend' }, [
          chip('lg-written', '已写'),
          chip('lg-read', '已读'),
          chip('lg-queued', '待读'),
          h('span', { class: 'graph-legend-sep' }, '·'),
          h('span', { class: 'graph-legend-rel' }, '先读 builds-on · 用到 uses · 同台 sibling · 节点可拖拽'),
        ]),
        h('p', { class: 'graph-widget-caption', 'aria-live': 'polite' },
          caption.value || '悬停节点看一句话简介 · 拖拽可重排 · 点 coral 实心节点进入对应文章'),
      ]);
    };
  },
});

// 移动端 aside 不渲染（<1280px），doc-bottom 给一行入口补偿；/graph/ 页自指排除
const GraphMobileLink = defineComponent({
  setup() {
    const route = useRoute();
    return () => {
      if (route.path.includes('/graph/')) return null;
      return h('p', { class: 'graph-mobile-entry' }, [
        h('a', { href: withBase('/graph/') }, '查看 graph →'),
      ]);
    };
  },
});

// 左边栏收起（Cursor IDE 风）：按钮固定视口左下角——侧栏展开时嵌在侧栏
// 底部（activity bar 位），收起时独立在左下角。展开态 localStorage 记忆；
// 仅在有 sidebar 的页面显示。移动端（<960px）交给原生 VPLocalNav。
const SidebarToggle = defineComponent({
  setup() {
    const route = useRoute();
    const { hasSidebar } = useSidebar();
    const collapsed = ref(false);
    const apply = () => {
      document.documentElement.classList.toggle('sidebar-collapsed', collapsed.value);
    };
    let animTimer = 0;
    const toggle = () => {
      collapsed.value = !collapsed.value;
      apply();
      // 过渡窗口内挂类：星图 sim 停帧让路主线程（掉帧治本）
      document.documentElement.classList.add('layout-animating');
      clearTimeout(animTimer);
      animTimer = window.setTimeout(() => {
        document.documentElement.classList.remove('layout-animating');
        // 布局尘埃落定后重锚浮层：收放使 aside 横移，place 只在 resize/路由时跑（K3 P0-2）
        window.dispatchEvent(new Event('resize'));
      }, 480);
      try { localStorage.setItem('wiki-sidebar-collapsed', collapsed.value ? '1' : '0'); } catch { /* ignore */ }
    };
    onMounted(() => {
      try { collapsed.value = localStorage.getItem('wiki-sidebar-collapsed') === '1'; } catch { /* ignore */ }
      apply();
      watch(() => route.path, () => nextTick(apply));
    });
    return () => {
      if (!hasSidebar.value) return null;
      return h('button', {
        class: ['sidebar-toggle-btn', collapsed.value ? 'is-collapsed' : ''],
        onClick: toggle,
        title: collapsed.value ? '展开侧边栏' : '收起侧边栏',
        'aria-label': '收起或展开左侧导航栏',
      }, [
        // Cursor/VS Code 同款 layout-sidebar：外框面板 + 左侧分隔（侧栏区）。
        // btn-side 状态条 = 侧栏缩影：展开时深色填充，收起时透明
        h('svg', { viewBox: '0 0 16 16', width: 17, height: 17, fill: 'none', stroke: 'currentColor', 'stroke-width': 1.5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, [
          h('rect', { class: 'btn-side', x: '2.25', y: '3.25', width: '4', height: '9.5', rx: '1.2' }),
          h('rect', { x: '2.25', y: '3.25', width: '11.5', height: '9.5', rx: '1.75' }),
          h('path', { d: 'M6.25 3.25v9.5' }),
        ]),
      ]);
    };
  },
});

export default {
  extends: DefaultTheme,
  Layout: () =>
    h(DefaultTheme.Layout, null, {
      'layout-top': () => [h(ProgressBar), h(BrandTitle), h(RandomPick), h(SidebarToggle)],
      'doc-after': () => [h(ReadingTime), h(Lede)],
      'doc-bottom': () => [h(ZoomImages), h(GraphMobileLink)],
      'aside-outline-after': () => h(GraphAside),
    }),
  enhanceApp({ app }: any) {
    app.component('GraphFull', GraphFull);
  },
};
