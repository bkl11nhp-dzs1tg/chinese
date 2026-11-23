// Router theo hash: #/today, #/lesson/L01, #/session?mode=review ...
// Mỗi màn hình: render(root, ctx, { params, query }) → có thể trả về hàm dọn dẹp.

export function createRouter(routes, { onChange } = {}) {
  let cleanup = null;
  let token = 0;

  function parse() {
    const raw = location.hash.replace(/^#\/?/, '') || 'today';
    const [path, qs] = raw.split('?');
    const parts = path.split('/').filter(Boolean).map(decodeURIComponent);
    const query = Object.fromEntries(new URLSearchParams(qs || ''));
    for (const r of routes) {
      const segs = r.path.split('/');
      if (segs.length !== parts.length) continue;
      const params = {};
      if (segs.every((s, i) => (s.startsWith(':') ? ((params[s.slice(1)] = parts[i]), true) : s === parts[i]))) {
        return { route: r, params, query, name: segs[0] };
      }
    }
    return { route: routes[0], params: {}, query, name: routes[0].path };
  }

  async function run(root, ctx) {
    const my = ++token;
    if (typeof cleanup === 'function') {
      try { await cleanup(); } catch (e) { console.error(e); }
    }
    cleanup = null;
    const m = parse();
    onChange?.(m);
    try {
      const c = await m.route.render(root, ctx, m);
      if (my === token) cleanup = c;
      else if (typeof c === 'function') c();
    } catch (e) {
      console.error(e);
      root.textContent = `Có lỗi khi mở màn hình: ${e.message}`;
    }
    root.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }

  return {
    start(root, ctx) {
      window.addEventListener('hashchange', () => run(root, ctx));
      return run(root, ctx);
    },
    reload: (root, ctx) => run(root, ctx),
  };
}
