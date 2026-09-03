import DefaultTheme from 'vitepress/theme';
import { h, defineComponent, onMounted, onBeforeUnmount, watch, nextTick } from 'vue';
import { useRoute } from 'vitepress';
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

// "约 N 分钟读完" injected under each doc's H1
const ReadingTime = defineComponent({
  setup() {
    const route = useRoute();
    const inject = () => {
      const content = document.querySelector('.content-container') ?? document.querySelector('.content');
      const h1 = content?.querySelector('h1');
      if (!content || !h1 || content.querySelector('.reading-time')) return;
      const text = content.innerText ?? '';
      const cjk = (text.match(/[\u4e00-\u9fff]/g) ?? []).length;
      const words = (text.match(/[a-zA-Z]+/g) ?? []).length;
      const minutes = Math.max(1, Math.round(cjk / 400 + words / 220));
      const tag = document.createElement('p');
      tag.className = 'reading-time';
      tag.textContent = `约 ${minutes} 分钟读完`;
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
const ZoomImages = defineComponent({
  setup() {
    const route = useRoute();
    let attached = false;
    const apply = async () => {
      if (attached) return;
      attached = true;
      // dynamic import keeps the browser-only lib out of the SSR graph
      const { default: mediumZoom } = await import('medium-zoom');
      const zoom = mediumZoom('.content img', { background: 'var(--vp-c-bg)' });
      const reattach = () => zoom.attach([...document.querySelectorAll('.content img')]);
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

export default {
  extends: DefaultTheme,
  Layout: () =>
    h(DefaultTheme.Layout, null, {
      'layout-top': () => h(ProgressBar),
      'doc-after': () => h(ReadingTime),
      'doc-bottom': () => h(ZoomImages),
    }),
};
