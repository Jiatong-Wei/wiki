import DefaultTheme from 'vitepress/theme';
import { h, defineComponent, onMounted, onBeforeUnmount, watch, nextTick, ref, computed } from 'vue';
import { useRoute, useData, withBase } from 'vitepress';
import { useSidebar } from 'vitepress/theme';
import './custom.css';
import { captionFor } from './GraphView';
import { GRAPH_NODES, GRAPH_EDGES, STATE_LABEL, startLinkSim } from '../graph-data';

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
      tag.title = '字数口径：正文含标题与盾标，不含代码、公式与导语';
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

// 关联星图侧栏挂载（本页目录正下方）：当前文章高亮，活体引力微动
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

    let sim: ReturnType<typeof startLinkSim> | null = null;
    let raf = 0;
    const simReady = ref(false);
    onMounted(() => {
      try {
        if (!sessionStorage.getItem('graph-grew')) {
          animate.value = true;
          sessionStorage.setItem('graph-grew', '1');
        }
      } catch { /* 存储被禁用时静默降级 */ }
      sim = startLinkSim();
      simReady.value = true; // ref 触发重渲染，不靠裸变量时机
      const loop = () => {
        if (sim) {
          sim.tick();
          // 空闲门：能量归零且无交互时不再推帧（画面静止，重渲染恒等）
          if (sim.strength > 0 || hoveredId.value) tickId.value++;
        }
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
      watch(() => route.path, () => {
        animate.value = false;
        caption.value = '';
        hoveredId.value = null; // 跨路由清 hover 残留
      });
    });
    onBeforeUnmount(() => { cancelAnimationFrame(raf); });

    return () => {
      const c = center.value;
      if (!c || excluded.value) return null;
      if (!simReady.value || !sim) return h('div', { class: 'graph-widget' }, [
        h('div', { class: 'graph-widget-head' }, [
          h('span', { class: 'graph-widget-title' }, '关联星图'),
          h('a', { class: 'graph-widget-link', href: withBase('/graph/') }, '全图 →'),
        ]),
      ]);
      tickId.value; // 订阅重渲染（rAF 驱动）
      const nodes = sim.nodes;
      const edges = sim.edges;
      const pos = sim.pos;
      // compact bbox 视窗
      const xs = nodes.map((n) => pos[n.id].x);
      const ys = nodes.map((n) => pos[n.id].y);
      const pad = 46;
      const vx0 = Math.min(...xs) - pad, vy0 = Math.min(...ys) - pad;
      const vw = Math.max(...xs) + pad - vx0, vhh = Math.max(...ys) + pad - vy0;
      const hid = hoveredId.value;
      const S = { r: 9, label: 22, queuedSW: 3, focusSW: 3.2, edge: 2.8 };

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
        const showLabel = n.id === c.id;
        const inner: any[] = [h('circle', {
          cx: p.x, cy: p.y, r: isHover ? S.r + 2 : S.r,
          class: ['gv-node', `gv-${n.state}`, isHover ? 'gv-node-on' : '', dim ? 'gv-dim' : ''],
          'stroke-width': n.state === 'queued' ? (isHover ? S.focusSW : S.queuedSW) : isHover ? S.focusSW : 0,
        })];
        if (showLabel) {
          const halfLab = (n.label.length * S.label * 0.6) / 2;
          inner.push(h('text', {
            x: Math.max(vx0 + halfLab + 4, Math.min(vx0 + vw - halfLab - 4, p.x)),
            y: p.y + 22,
            class: ['gv-label', isHover ? 'gv-label-on' : '', dim ? 'gv-dim' : ''],
            'text-anchor': 'middle', 'font-size': S.label,
          }, n.label));
        }
        inner.push(h('circle', {
          cx: p.x, cy: p.y, r: 26, class: 'gv-hit',
          onMouseenter: () => {
            hoveredId.value = n.id;
            caption.value = captionFor(n, c.id);
            sim?.wake(n.id); // 摇醒邻居
          },
          onMouseleave: () => { hoveredId.value = null; caption.value = ''; },
          onClick: () => { if (n.state !== 'written') caption.value = `「${n.label}」${STATE_LABEL[n.state]} — ${n.note}`; },
        }));
        return h('g', { key: n.id }, [
          n.state === 'written' && n.article ? h('a', { href: withBase(n.article) }, inner) : inner,
        ]);
      };

      return h('div', { class: ['graph-widget', animate.value ? 'graph-widget-anim' : ''] }, [
        h('div', { class: 'graph-widget-head' }, [
          h('span', { class: 'graph-widget-title' }, '关联星图'),
          h('a', { class: 'graph-widget-link', href: withBase('/graph/') }, '全图 →'),
        ]),
        h('svg', {
          viewBox: `${vx0} ${vy0} ${vw} ${vhh}`, class: 'gv-svg gv-compact',
          role: 'img',
          'aria-label': '关联星图：coral 实心为已写文章，灰实心为已读，空心为待读',
        }, [
          h('title', {}, '关联星图'),
          ...edges.map(renderEdge).filter(Boolean),
          ...nodes.map(renderNode),
        ]),
        h('p', { class: 'graph-widget-caption', 'aria-live': 'polite' },
          caption.value ||
            `${GRAPH_NODES.length} 个工作 · ${GRAPH_EDGES.length} 条链 · 悬停看简介，coral 实心可点进文章`),
      ]);
    };
  },
});

// 全图页 <GraphFull />（graph.md 内直接用，enhanceApp 全局注册）
// Obsidian 式交互：活体引力 + 拖拽节点 + 悬停邻居聚集
const GraphFull = defineComponent({
  setup() {
    const caption = ref('');
    const hoveredId = ref<string | null>(null);
    const tickId = ref(0);

    let sim: ReturnType<typeof startLinkSim> | null = null;
    let raf = 0;
    let dragId: string | null = null;
    let dragMoved = false; // 拖拽守卫：位移超阈值才算拖，否则松手算点击
    let dragStart = { x: 0, y: 0 };
    let svgEl: SVGSVGElement | null = null;

    const clientToGraph = (ev: MouseEvent | TouchEvent): { x: number; y: number } | null => {
      if (!svgEl) return null;
      const rect = svgEl.getBoundingClientRect();
      const cx = 'touches' in ev ? ev.touches[0].clientX : ev.clientX;
      const cy = 'touches' in ev ? ev.touches[0].clientY : ev.clientY;
      const scale = 1000 / rect.width;
      return { x: (cx - rect.left) * scale, y: (cy - rect.top) * (760 / rect.height) };
    };
    const onMove = (ev: MouseEvent | TouchEvent) => {
      if (!dragId || !sim) return;
      const g = clientToGraph(ev);
      if (!g) return;
      const dx = g.x - dragStart.x, dy = g.y - dragStart.y;
      if (!dragMoved && Math.hypot(dx, dy) > 5) dragMoved = true;
      sim.pos[dragId].x = g.x;
      sim.pos[dragId].y = g.y;
      // 拖拽中 pin 跳过积分；wake 邻居抬能量让周围跟上（不灌速度给被拖节点）
      for (const e of GRAPH_EDGES) {
        if (e.a === dragId) sim.wake(e.b);
        if (e.b === dragId) sim.wake(e.a);
      }
      if ('touches' in ev) ev.preventDefault();
    };
    const onUp = () => {
      dragId = null;
      if (sim) sim.pinned = null;
      // click 守卫：拖拽结束的 click 事件在 setTimeout 后清，避免松手跳链
      setTimeout(() => { dragMoved = false; }, 0);
    };
    onMounted(() => {
      sim = startLinkSim();
      const loop = () => {
        if (sim) { sim.tick(); tickId.value++; }
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
      window.addEventListener('touchmove', onMove, { passive: false });
      window.addEventListener('touchend', onUp);
    });
    onBeforeUnmount(() => {
      cancelAnimationFrame(raf);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onUp);
    });

    const chip = (cls: string, text: string) =>
      h('span', { class: ['graph-legend-chip', cls] }, text);
    return () => {
      if (!sim) return null;
      tickId.value;
      const { nodes, edges, pos } = sim;
      const hid = hoveredId.value;
      const S = { r: 7, label: 15, labelGap: 13, queuedSW: 2.2, focusSW: 2.6, edge: 1.6 };

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
        const halfLab = (n.label.length * S.label * 0.6) / 2;
        inner.push(h('text', {
          x: Math.max(halfLab + 6, Math.min(1000 - halfLab - 6, p.x)),
          y: p.y + S.labelGap,
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
            if (sim) sim.pinned = n.id; // 钉住：物理不施力，拖拽不抖动
            ev.preventDefault();
          },
          onTouchstart: (ev: TouchEvent) => {
            dragId = n.id;
            dragMoved = false;
            const g = clientToGraph(ev);
            if (g) dragStart = g;
            if (sim) sim.pinned = n.id;
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
          viewBox: '0 0 1000 760', class: 'gv-svg', role: 'img',
          'aria-label': '关联星图：coral 实心为已写文章，灰实心为已读，空心为待读',
        }, [
          h('title', {}, '关联星图'),
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
        h('a', { href: withBase('/graph/') }, '查看关联星图 →'),
      ]);
    };
  },
});

// 左边栏收起：桌面一键收拢 sidebar，内容区/星图随之放大。
// 展开态 localStorage 记忆；仅在有 sidebar 的页面显示按钮。
// 移动端（<960px）交给原生 VPLocalNav "Menu" 按钮，不另造状态桥。
const SidebarToggle = defineComponent({
  setup() {
    const route = useRoute();
    const { hasSidebar } = useSidebar();
    const collapsed = ref(false);
    const apply = () => {
      document.documentElement.classList.toggle('sidebar-collapsed', collapsed.value);
    };
    const toggle = () => {
      collapsed.value = !collapsed.value;
      apply();
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
        title: collapsed.value ? '展开侧边栏' : '收起侧边栏，内容区放大',
        'aria-label': '收起或展开左侧导航栏',
      }, [
        h('svg', { viewBox: '0 0 16 16', width: 16, height: 16, fill: 'none', stroke: 'currentColor', 'stroke-width': 1.5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, [
          h('path', { d: 'M2.5 2.5v11M6 2.5v11M6 2.5h7.5a1.5 1.5 0 0 1 1.5 1.5v8a1.5 1.5 0 0 1-1.5 1.5H6M6 8.5h4' }),
        ]),
      ]);
    };
  },
});

export default {
  extends: DefaultTheme,
  Layout: () =>
    h(DefaultTheme.Layout, null, {
      'layout-top': () => [h(ProgressBar), h(BrandTitle), h(RandomPick)],
      'doc-after': () => [h(ReadingTime), h(Lede)],
      'doc-bottom': () => [h(ZoomImages), h(GraphMobileLink)],
      'aside-outline-after': () => h(GraphAside),
      'nav-bar-content-before': () => h(SidebarToggle),
    }),
  enhanceApp({ app }: any) {
    app.component('GraphFull', GraphFull);
  },
};
