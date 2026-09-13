import DefaultTheme from 'vitepress/theme';
import { h, defineComponent, onMounted, onBeforeUnmount, watch, nextTick, ref, computed } from 'vue';
import { useRoute, useData, withBase } from 'vitepress';
import './custom.css';
import { GraphView, captionFor } from './GraphView';
import { GRAPH_NODES, GRAPH_EDGES, STATE_LABEL } from '../graph-data';

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

// 知识图谱侧栏挂载（本页目录正下方）：当前文章在星图中高亮，
// hover 出一句话简介，coral 实心（written）节点可点进文章。
// /graph/ /random/ 等工具页与无图节点的文章不渲染。
const GraphAside = defineComponent({
  setup() {
    const route = useRoute();
    const caption = ref('');
    const animate = ref(false);
    const excluded = computed(() => ['/graph/', '/random/'].some((p) => route.path.includes(p)));
    const center = computed(() => {
      const path = route.path.replace(/\/$/, '');
      return (
        GRAPH_NODES.find((n) => n.article && path === withBase(n.article).replace(/\/$/, '')) ??
        null
      );
    });
    onMounted(() => {
      try {
        if (!sessionStorage.getItem('graph-grew')) {
          animate.value = true;
          sessionStorage.setItem('graph-grew', '1');
        }
      } catch {
        /* 存储被禁用时静默降级：只丢动画不丢功能 */
      }
      watch(() => route.path, () => {
        animate.value = false;
        caption.value = ''; // 跨路由清残留 caption，别让上一篇的简介赖着不走
      });
    });
    return () => {
      const c = center.value;
      if (!c || excluded.value) return null;
      return h('div', { class: ['graph-widget', animate.value ? 'graph-widget-anim' : ''] }, [
        h('div', { class: 'graph-widget-head' }, [
          h('span', { class: 'graph-widget-title' }, '知识图谱'),
          h('a', { class: 'graph-widget-link', href: withBase('/graph/') }, '全图 →'),
        ]),
        h(GraphView, {
          compact: true,
          labelMode: 'ids',
          labelIds: [c.id],
          animate: animate.value,
          onHover: (n: any) => { caption.value = n ? captionFor(n, c.id) : ''; },
          onPick: (n: any) => {
            if (n.state !== 'written') caption.value = `「${n.label}」${STATE_LABEL[n.state]} — ${n.note}`;
          },
        }),
        h(
          'p',
          { class: 'graph-widget-caption', 'aria-live': 'polite' },
          caption.value ||
            `${GRAPH_NODES.length} 个工作 · ${GRAPH_EDGES.length} 条链 · 悬停看简介，coral 实心可点进文章`,
        ),
      ]);
    };
  },
});

// 全图页 <GraphFull />（graph.md 内直接用，enhanceApp 全局注册）
const GraphFull = defineComponent({
  setup() {
    const caption = ref('');
    const onHover = (n: any) => { caption.value = n ? captionFor(n) : ''; };
    const onPick = (n: any) => {
      if (n.state !== 'written') caption.value = `「${n.label}」${STATE_LABEL[n.state]} — ${n.note}`;
    };
    const chip = (cls: string, text: string) =>
      h('span', { class: ['graph-legend-chip', cls] }, text);
    return () =>
      h('div', { class: 'graph-full' }, [
        h(GraphView, { labelMode: 'all', onHover, onPick }),
        h(
          'div',
          { class: 'graph-legend' },
          [
            chip('lg-written', '已写'),
            chip('lg-read', '已读'),
            chip('lg-queued', '待读'),
            h('span', { class: 'graph-legend-sep' }, '·'),
            h('span', { class: 'graph-legend-rel' }, '先读 builds-on · 用到 uses · 同台 sibling'),
          ],
        ),
        h(
          'p',
          { class: 'graph-widget-caption', 'aria-live': 'polite' },
          caption.value || '悬停节点看一句话简介 · 点 coral 实心节点进入对应文章',
        ),
      ]);
  },
});

// 移动端 aside 不渲染（<1280px），doc-bottom 给一行入口补偿；/graph/ 页自指排除
const GraphMobileLink = defineComponent({
  setup() {
    const route = useRoute();
    return () => {
      if (route.path.includes('/graph/')) return null;
      return h('p', { class: 'graph-mobile-entry' }, [
        h('a', { href: withBase('/graph/') }, '查看知识图谱 →'),
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
    }),
  enhanceApp({ app }: any) {
    app.component('GraphFull', GraphFull);
  },
};
