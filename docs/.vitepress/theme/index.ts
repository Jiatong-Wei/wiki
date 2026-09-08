import DefaultTheme from 'vitepress/theme';
import { h, defineComponent, onMounted, onBeforeUnmount, watch, nextTick } from 'vue';
import { useRoute, useData } from 'vitepress';
import './custom.css';

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

// "date · 约 N 分钟读完" injected under each doc's H1
const ReadingTime = defineComponent({
  setup() {
    const route = useRoute();
    const { frontmatter } = useData();
    const inject = () => {
      const content = document.querySelector('.content-container') ?? document.querySelector('.content');
      const h1 = content?.querySelector('h1');
      if (!content || !h1 || content.querySelector('.reading-time')) return;
      const text = content.innerText ?? '';
      const cjk = (text.match(/[\u4e00-\u9fff]/g) ?? []).length;
      const words = (text.match(/[a-zA-Z]+/g) ?? []).length;
      const minutes = Math.max(1, Math.round(cjk / 400 + words / 220));
      const raw = frontmatter.value.date as string | undefined;
      const date = raw ? raw.slice(0, 10) : undefined;
      const tag = document.createElement('p');
      tag.className = 'reading-time';
      tag.textContent = (date ? `${date} · ` : '') + `约 ${minutes} 分钟读完`;
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

export default {
  extends: DefaultTheme,
  Layout: () =>
    h(DefaultTheme.Layout, null, {
      'layout-top': () => [h(ProgressBar), h(BrandTitle), h(RandomPick)],
      'doc-after': () => [h(ReadingTime), h(Lede)],
      'doc-bottom': () => h(ZoomImages),
    }),
};
