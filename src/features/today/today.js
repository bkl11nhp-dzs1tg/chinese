// Màn hình Hôm nay (mục 9.1): một nút chính "Học tiếp", vòng mục tiêu phút học, chuỗi ngày.
// Không có thông báo trách móc khi bỏ ngày.

import { h, mount } from '../../ui/dom.js';
import { icon, badgeIcon } from '../../ui/icons.js';
import { newLearnedToday, timeTotals, streak, formatDuration, startOfDay } from '../../core/stats.js';
import { newCardQueue } from '../../core/lessons.js';
import { scoreRing } from '../exercises/result-view.js';

const WEEKDAYS = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];

export async function render(root, ctx) {
  const data = await ctx.loadAll();
  const s = ctx.settings;
  const now = Date.now();
  if (!data.cards.length) return renderEmpty(root);

  const [events, sessions] = await Promise.all([
    ctx.repo.byIndex('review_events', 'created_at', IDBKeyRange.lowerBound(startOfDay(now))),
    ctx.repo.getAll('study_sessions'),
  ]);
  const due = data.states.filter((st) => st.due_at <= now).length;
  const learnedToday = newLearnedToday(events, now);
  const quota = Math.max(0, s.new_per_day - learnedToday);
  const available = newCardQueue(data.lessons, data.cardsById, data.statesById, data.active?.id).length;
  const suggestedNew = Math.min(quota, available);
  const totals = timeTotals(sessions, now);
  const st = streak(sessions, now);
  const goalMs = s.session_minutes * 60000;
  const goalFrac = Math.min(1, totals.today / goalMs);
  const active = data.active;
  const activeSt = active ? data.statusById.get(active.id) : null;
  const d = new Date(now);
  const nothingToDo = due === 0 && suggestedNew === 0;
  const backupHint = now - (s.last_export_at || 0) > 7 * 86400000 && data.states.length > 20;
  const doneLessons = data.lessons.filter((l) => data.statusById.get(l.id).status === 'done').length;

  const ring = scoreRing(goalFrac, { size: 112, stroke: 12, passed: goalFrac >= 1 ? true : null });
  ring.querySelector('text').textContent = `${Math.round(totals.today / 60000)}′`;
  ring.setAttribute('aria-label', `Đã học ${Math.round(totals.today / 60000)} trên ${s.session_minutes} phút hôm nay`);

  const upcoming = active ? active.vocab_ids.map((id) => data.cardsById.get(id)).filter((c) => c && !data.statesById.get(c.id)?.last_reviewed_at).slice(0, 6) : [];
  // Bước tiếp theo của bài đang học
  let lessonCta = null;
  if (active) {
    const allLearned = activeSt.total > 0 && activeSt.learned === activeSt.total;
    lessonCta = allLearned
      ? { label: 'Làm kiểm tra cuối bài', href: `#/test/${encodeURIComponent(active.id)}` }
      : { label: activeSt.learned ? 'Học tiếp bài này' : 'Bắt đầu bài này', href: `#/session?lesson=${encodeURIComponent(active.id)}` };
  }

  mount(root,
    h('div', { class: 'large-title' },
      h('div', {}, h('div', { class: 'sub' }, `${WEEKDAYS[d.getDay()]}, ${d.getDate()}/${d.getMonth() + 1}`), h('h1', {}, 'Hôm nay')),
      h('div', { class: 'chips-row' },
        h('span', { class: 'stat-chip flame', title: 'Chuỗi ngày học', 'aria-label': `Chuỗi ${st} ngày` }, icon('lantern'), String(st)),
        s.cat_enabled ? h('span', { class: 'stat-chip', title: 'XP' }, icon('star'), String(s.xp_total || 0)) : null)),

    h('div', { class: 'today-top' }, h('div', { class: 'hero px-box today-hero' },
      h('div', { class: 'row nowrap', style: { alignItems: 'center', gap: '16px' } },
        h('div', { style: { flex: 1 } },
          h('div', { class: 'q-type' }, 'Mục tiêu hôm nay'),
          h('h2', { style: { margin: '4px 0' } }, nothingToDo ? 'Đã xong phần hôm nay' : `${due} thẻ ôn · ${suggestedNew} từ mới`),
          h('p', { class: 'muted small', style: { margin: 0 } }, `${formatDuration(totals.today)} / ${s.session_minutes} phút`)),
        ring),
      h('ul', { class: 'plan-list' },
        planRow('repeat', 'Ôn tập đến hạn', due ? `${due} thẻ` : 'không có', due ? 'learning' : ''),
        planRow('sparkle', 'Từ mới', suggestedNew ? `${suggestedNew} từ` : 'đủ hôm nay', suggestedNew ? 'new' : ''),
        planRow('pencil', 'Luyện tập', active ? `Bài ${active.unit ?? ''}` : '—', ''),
        planRow('game', 'Trò chơi cuối buổi', s.games_enabled ? 'nối cặp' : 'tắt', '')),
      h('div', { class: 'stack hero-actions' },
        h('a', { class: 'btn primary big block', href: '#/session' }, icon('play'), nothingToDo ? 'Học thêm' : 'Bắt đầu buổi học'),
        due ? h('a', { class: 'btn big block', href: '#/session?mode=review' }, icon('repeat'), `Chỉ ôn tập (${due})`) : null)),

    active ? h('div', { class: 'today-active' },
      h('div', { class: 'section-title today-st' }, 'Bài đang học'),
      h('div', { class: 'group' },
        h('a', { class: 'lesson-card', style: { boxShadow: 'none' }, href: `#/lesson/${encodeURIComponent(active.id)}` },
          h('span', { class: 'thumb' }, h('img', { src: `./lessons/${encodeURIComponent(active.id)}.webp`, alt: '', onerror: (e) => e.target.remove() })),
          h('span', { class: 'info' },
            h('span', { class: 'num' }, `BÀI ${active.unit ?? ''} · ${activeSt.learned}/${activeSt.total} TỪ`),
            h('span', { class: 'han t' }, active.title),
            h('span', { class: 'vi' }, active.title_vi || '')),
          icon('chevron')),
        h('div', { class: 'active-body' },
          h('div', { class: 'bar', style: { margin: '4px 0 0' } }, h('span', { style: { width: `${activeSt.total ? (activeSt.learned / activeSt.total) * 100 : 0}%` } })),
          upcoming.length ? h('div', { class: 'upcoming' },
            h('div', { class: 'muted small', style: { marginBottom: '6px' } }, activeSt.learned ? 'Từ tiếp theo' : 'Từ sẽ học'),
            h('div', { class: 'up-chips' }, upcoming.map((c) => h('span', { class: 'up-chip' }, h('span', { class: 'han' }, c.hanzi), h('small', {}, c.meaning))))) : null,
          h('div', { class: 'mini-steps' },
            miniStep('cards', 'Từ mới', `${activeSt.learned}/${activeSt.total}`, activeSt.total > 0 && activeSt.learned === activeSt.total),
            miniStep('lessons', 'Bài khóa', active.texts?.length ? `${active.texts.reduce((n, t) => n + t.lines.length, 0)} câu` : '—', false),
            miniStep('trophy', 'Kiểm tra', activeSt.test_best != null ? `${Math.round(activeSt.test_best * 100)}%` : 'chưa làm', activeSt.status === 'done')),
          h('a', { class: 'btn tinted block', href: lessonCta.href }, lessonCta.label))),
    ) : null),

    h('div', { class: 'section-title' }, 'Tổng quan'),
    h('div', { class: 'grid' },
      tile(formatDuration(totals.week), '7 ngày qua'),
      tile(`${doneLessons}/${data.lessons.length}`, 'bài hoàn thành'),
      tile(data.states.length, 'từ đã học'),
      h('a', { class: 'tile px-box', href: '#/games', style: { textDecoration: 'none', color: 'inherit' } },
        h('div', { class: 'value', style: { color: 'var(--accent-ink)' } }, icon('game')), h('div', { class: 'label' }, 'Trò chơi ôn từ'))),

    backupHint ? h('p', { class: 'notice small mt' },
      'Dữ liệu chỉ nằm trong trình duyệt này. Thỉnh thoảng nên ', h('a', { href: '#/settings' }, 'xuất bản sao lưu'), '.') : null,
  );
}

const tile = (v, l) => h('div', { class: 'tile px-box' }, h('div', { class: 'value' }, v), h('div', { class: 'label' }, l));

async function renderEmpty(root) {
  mount(root,
    h('div', { class: 'large-title' }, h('h1', {}, 'Chào mừng!')),
    h('div', { class: 'hero px-box stack center' },
      badgeIcon('books'),
      h('p', {}, 'Chưa có nội dung học. Nội dung được lấy từ thư mục data/ khi đóng gói app.'),
      h('p', { class: 'muted small' }, 'Trên máy: chạy “npm run pack” rồi mở lại trang. Nếu đang offline lần đầu, hãy kết nối mạng và tải lại.'),
      h('button', { class: 'btn primary big block', type: 'button', onclick: () => location.reload() }, 'Tải lại')),
  );
}

function planRow(ic, label, value, tone) {
  return h('li', { class: ['plan-row', tone] }, h('span', { class: 'plan-ic' }, icon(ic)), h('span', { class: 'grow' }, label), h('strong', {}, value));
}

function miniStep(ic, label, value, done) {
  return h('div', { class: ['mini-step', done ? 'done' : ''] }, h('span', { class: 'plan-ic' }, icon(done ? 'check' : ic)), h('span', {}, h('small', {}, label), h('strong', {}, value)));
}
