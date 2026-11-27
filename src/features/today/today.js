// Màn hình Hôm nay (mục 9.1): một nút chính "Học tiếp", vòng mục tiêu phút học, chuỗi ngày.
// Không có thông báo trách móc khi bỏ ngày.

import { h, mount } from '../../ui/dom.js';
import { icon, badgeIcon } from '../../ui/icons.js';
import { newLearnedToday, timeTotals, streak, formatDuration, startOfDay } from '../../core/stats.js';
import { newCardQueue, nextLessonStep } from '../../core/lessons.js';
import { SKILLS } from '../../core/practice.js';
import { recentInfo } from '../practice/practice.js';
import { dayKey, addDays } from '../../core/stats.js';

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
  // Số từ vừa học chưa hỏi đáp xong (giảm dần khi làm; về 0 thì ẩn nút).
  const recent = await recentInfo(ctx, data, now);
  const recentN = recent.cards.length >= 4 ? recent.pending.length : 0;
  const learnedToday = newLearnedToday(events, now);
  const quota = Math.max(0, s.new_per_day - learnedToday);
  const available = newCardQueue(data.lessons, data.cardsById, data.statesById, data.active?.id).length;
  const suggestedNew = Math.min(quota, available);
  const totals = timeTotals(sessions, now);
  const st = streak(sessions, now);
  const active = data.active;
  const activeSt = active ? data.statusById.get(active.id) : null;
  const d = new Date(now);
  const nothingToDo = due === 0 && suggestedNew === 0;
  const doneLessons = data.lessons.filter((l) => data.statusById.get(l.id).status === 'done').length;

  const ring = goalRing(totals.today / 60000, s.session_minutes);

  // Bước tiếp theo của bài đang học
  let lessonCta = null;
  if (active) {
    const rp = await ctx.repo.get('reading_progress', `lesson:${active.id}`);
    const next = data.lessons[data.lessons.indexOf(active) + 1] || null;
    lessonCta = nextLessonStep(active, activeSt, { readFinished: !!rp?.finished, readStarted: !!rp, threshold: s.pass_threshold, next });
  }

  mount(root,
    h('div', { class: 'large-title' },
      h('div', {}, h('div', { class: 'sub' }, `${WEEKDAYS[d.getDay()]}, ${d.getDate()}/${d.getMonth() + 1}`), h('h1', {}, 'Hôm nay')),
      h('div', { class: 'chips-row' },
        h('span', { class: 'stat-chip flame', title: 'Chuỗi ngày học', 'aria-label': `Chuỗi ${st} ngày` }, icon('flame'), String(st)),
      )),

    h('div', { class: 'today-top' }, h('div', { class: 'hero px-box today-hero' },
      h('img', { class: 'deco deco-branch', src: './art/deco/branch.webp', alt: '', 'aria-hidden': 'true' }),
      h('div', { class: 'row nowrap', style: { alignItems: 'center', gap: '16px' } },
        h('div', { style: { flex: 1 } },
          h('div', { class: 'q-type' }, 'Mục tiêu hôm nay'),
          h('h2', { style: { margin: '4px 0' } }, nothingToDo ? 'Xong hôm nay' : `${due} thẻ ôn · ${suggestedNew} từ mới`),
          h('p', { class: ['muted', 'small', totals.today >= s.session_minutes * 60000 ? 'goal-hit' : ''], style: { margin: 0 } }, totals.today >= s.session_minutes * 60000 ? `Vượt mục tiêu ${s.session_minutes} phút` : `${formatDuration(totals.today)} / ${s.session_minutes} phút`)),
        ring),
      h('ul', { class: 'plan-list' },
        planRow('repeat', 'Ôn tập đến hạn', due ? `${due} thẻ` : 'không có', due ? 'learning' : ''),
        planRow('sparkle', 'Từ mới', suggestedNew ? `${suggestedNew} từ` : 'đủ hôm nay', suggestedNew ? 'new' : ''),
        planRow('pencil', 'Luyện tập', active ? `Bài ${active.unit ?? ''}` : '—', ''),
        planRow('game', 'Trò chơi cuối buổi', s.games_enabled ? 'nối cặp' : 'tắt', '')),
      h('div', { class: 'stack hero-actions' },
        h('a', { class: 'btn primary big block', href: '#/session' }, icon('play'), nothingToDo ? 'Học thêm' : 'Bắt đầu buổi học'),
        due ? h('a', { class: 'btn big block', href: '#/session?mode=review' }, icon('repeat'), `Chỉ ôn tập (${due})`) : null,
        recentN > 0 ? h('a', { class: 'btn tinted big block', href: '#/practice/qa?scope=recent' }, icon('chat'), `Hỏi đáp từ vừa học (${recentN})`) : null)),

    active ? h('div', { class: 'today-active' },
      h('div', { class: 'section-title today-st' }, activeSt.status === 'done' ? 'Bài vừa hoàn thành' : 'Bài đang học'),
      h('div', { class: 'group active-group' },
        h('a', { class: 'lesson-card', style: { boxShadow: 'none' }, href: `#/lesson/${encodeURIComponent(active.id)}` },
          h('span', { class: 'thumb' }, h('img', { src: `./lessons/${encodeURIComponent(active.id)}.webp`, alt: '', onerror: (e) => e.target.remove() })),
          h('span', { class: 'info' },
            h('span', { class: 'num' }, `BÀI ${active.unit ?? ''} · ${activeSt.learned}/${activeSt.total} TỪ`),
            h('span', { class: 'han t' }, active.title),
            h('span', { class: 'vi' }, active.title_vi || ''),
            h('span', { class: 'bar thin' }, h('span', { style: { width: `${activeSt.total ? (activeSt.learned / activeSt.total) * 100 : 0}%` } }))),
          icon('chevron')),
        h('div', { class: 'active-body' },
          h('div', { class: 'mini-steps' },
            miniStep('cards', 'Từ mới', `${activeSt.learned}/${activeSt.total}`, activeSt.total > 0 && activeSt.learned === activeSt.total),
            miniStep('lessons', 'Bài khóa', active.texts?.length ? `${active.texts.reduce((n, t) => n + t.lines.length, 0)} câu` : '—', !['words', 'read'].includes(lessonCta.id)),
            miniStep('trophy', 'Kiểm tra', activeSt.test_best != null ? `${Math.round(activeSt.test_best * 100)}%` : 'chưa làm', activeSt.status === 'done')),
          h('a', { class: 'btn tinted block', href: lessonCta.href }, lessonCta.label))),
    ) : null),

    h('div', { class: 'today-bottom' },
      h('section', { class: 'card px-box week-card' },
        h('div', { class: 'row between nowrap' },
          h('div', {}, h('div', { class: 'q-type' }, 'Tuần này'), h('strong', { class: 'week-total' }, `${formatDuration(totals.week)} · ${doneLessons}/${data.lessons.length} bài xong`)),
          h('span', { class: ['streak-badge', st ? 'on' : ''] }, icon('flame'), h('span', {}, st ? `${st} ngày liên tiếp` : 'Bắt đầu chuỗi'))),
        h('div', { class: 'week-strip' }, weekDays(sessions, now))),
      h('section', { class: 'card px-box' },
        h('div', { class: 'row between' }, h('div', { class: 'q-type' }, 'Luyện theo kỹ năng'), h('a', { class: 'small link-more', href: '#/practice' }, 'Tất cả', icon('chevron'))),
        h('div', { class: 'skill-mini' }, SKILLS.slice(0, 6).map((k) => h('a', { class: ['skill-pill', `tone-${k.tone}`], href: `#/practice/${k.id}` },
          h('span', { class: 'sk-ic' }, icon(k.icon)), h('span', {}, k.label)))))),

  );
}

const tile = (v, l) => h('div', { class: 'tile px-box' }, h('div', { class: 'value' }, v), h('div', { class: 'label' }, l));

async function renderEmpty(root) {
  mount(root,
    h('div', { class: 'large-title' }, h('h1', {}, 'Chào mừng!')),
    h('div', { class: 'hero px-box stack center' },
      badgeIcon('books'),
      h('p', {}, 'Chưa tải được nội dung học.'),
      h('p', { class: 'muted small' }, 'Hãy kết nối mạng rồi tải lại trang.'),
      h('button', { class: 'btn primary big block', type: 'button', onclick: () => location.reload() }, 'Tải lại')),
  );
}

function planRow(ic, label, value, tone) {
  return h('li', { class: ['plan-row', tone] }, h('span', { class: 'plan-ic' }, icon(ic)), h('span', { class: 'grow' }, label), h('strong', {}, value));
}

function miniStep(ic, label, value, done) {
  return h('div', { class: ['mini-step', done ? 'done' : ''] }, h('span', { class: 'plan-ic' }, icon(done ? 'check' : ic)), h('span', {}, h('small', {}, label), h('strong', {}, value)));
}

/** 7 ngày của tuần hiện tại (T2 → CN): ngày đã học có lửa, hôm nay được viền. */
function weekDays(sessions, now) {
  const studied = new Set(sessions.filter((x) => (x.active_ms || 0) > 0).map((x) => dayKey(x.started_at)));
  const today = startOfDay(now);
  const dow = (new Date(today).getDay() + 6) % 7;
  const labels = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
  return labels.map((lb, i) => {
    const t = addDays(today, i - dow);
    const on = studied.has(dayKey(t));
    return h('span', { class: ['wd', on ? 'on' : '', t === today ? 'today' : '', t > today ? 'future' : ''], title: on ? 'Đã học' : '' },
      h('span', { class: 'wd-ic' }, on ? icon('flame') : String(new Date(t).getDate())), h('small', {}, lb));
  });
}

/** Vòng mục tiêu phút học: chữ số ở chính giữa (HTML), vượt mục tiêu thì thêm vòng thứ hai màu vàng + nhãn %. */
function goalRing(min, goal) {
  const m = Math.round(min);
  const frac = goal ? min / goal : 0;
  const S = 112, W = 12, r = (S - W) / 2, C = 2 * Math.PI * r;
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${S} ${S}`);
  svg.setAttribute('class', 'gr-svg');
  const arc = (cls, f, w = W, rr = r) => `<circle class="${cls}" cx="${S / 2}" cy="${S / 2}" r="${rr}" fill="none" stroke-width="${w}" stroke-linecap="round" stroke-dasharray="${2 * Math.PI * rr}" stroke-dashoffset="${2 * Math.PI * rr * (1 - Math.min(1, Math.max(0, f)))}" transform="rotate(-90 ${S / 2} ${S / 2})"${f <= 0.001 ? ' visibility="hidden"' : ''}/>`;
  svg.innerHTML = `<circle class="gr-track" cx="${S / 2}" cy="${S / 2}" r="${r}" fill="none" stroke-width="${W}"/>`
    + arc(frac >= 1 ? 'gr-done' : 'gr-val', Math.min(1, frac))
    + (frac > 1 ? arc('gr-over', frac - 1, 5, r - W + 1) : '');
  const over = frac >= 1;
  return h('div', { class: ['goal-ring', over ? 'over' : ''], role: 'img', 'aria-label': `Đã học ${m} trên ${goal} phút hôm nay` },
    svg,
    h('div', { class: 'gr-label' }, h('b', {}, String(m)), h('small', {}, `/ ${goal} phút`)),
    over ? h('span', { class: 'gr-badge' }, frac >= 1.05 ? `${Math.round(frac * 100)}%` : 'Đạt') : null);
}
