// Trang Thống kê (mục 9.9): tổng quan hôm nay + chuỗi ngày, lịch hoạt động 5 tuần,
// số liệu chính, phút học 14 ngày, từ vựng theo trạng thái, tỷ lệ nhớ đúng.

import { h, mount, pct } from '../../ui/dom.js';
import { icon } from '../../ui/icons.js';
import { columnChart, hbars } from '../../ui/chart.js';
import { dayKey, dailySeries, timeTotals, streak, cardStatusCounts, weeklyAccuracy, accuracyByActivity, formatDuration, startOfDay, addDays } from '../../core/stats.js';
import { scoreRing } from '../exercises/result-view.js';

const ACTIVITY = { review: 'Ôn thẻ', new: 'Thẻ mới', relearn: 'Ôn lại trong buổi', exercise: 'Bài tập', game: 'Trò chơi', practice: 'Luyện kỹ năng' };
const WD = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

export async function render(root, ctx) {
  const now = Date.now();
  const s = ctx.settings;
  const [data, sessions, events] = await Promise.all([ctx.loadAll(), ctx.repo.getAll('study_sessions'), ctx.repo.getAll('review_events')]);
  const totals = timeTotals(sessions, now);
  const series = dailySeries(sessions, now, 14);
  const counts = cardStatusCounts(data.cards, data.statesById);
  const weeks = weeklyAccuracy(events, now, 4);
  const byAct = accuracyByActivity(events);
  const lessonsDone = data.lessons.filter((l) => data.statusById.get(l.id).status === 'done').length;
  const st = streak(sessions, now);
  const dm = (d) => { const [, m, dd] = d.split('-'); return `${Number(dd)}/${Number(m)}`; };
  const minutes = (ms) => Math.round(ms / 60000);

  // Hoạt động theo ngày: phút học + số lượt ôn.
  const minByDay = new Map();
  for (const x of sessions) minByDay.set(dayKey(x.started_at), (minByDay.get(dayKey(x.started_at)) || 0) + (x.active_ms || 0));
  const evByDay = new Map();
  for (const e of events) evByDay.set(dayKey(e.created_at), (evByDay.get(dayKey(e.created_at)) || 0) + 1);
  const level = (k) => {
    const m = minutes(minByDay.get(k) || 0);
    if (m === 0) return evByDay.get(k) ? 1 : 0;
    return m < 6 ? 1 : m < 16 ? 2 : m < 31 ? 3 : 4;
  };

  // Lịch 5 tuần, bắt đầu từ thứ hai, kết thúc ở tuần hiện tại.
  const today = startOfDay(now);
  const dow = (new Date(today).getDay() + 6) % 7; // 0 = thứ hai
  const start = addDays(today, -dow - 28);
  const cells = [];
  for (let i = 0; i < 35; i++) {
    const t = addDays(start, i);
    const k = dayKey(t);
    const future = t > today;
    const m = minutes(minByDay.get(k) || 0);
    const n = evByDay.get(k) || 0;
    cells.push(h('span', {
      class: ['hm-cell', `l${future ? 'x' : level(k)}`, t === today ? 'today' : ''],
      title: future ? '' : `${dm(k)}: ${m} phút · ${n} lượt ôn`,
      'aria-label': future ? undefined : `${dm(k)}: ${m} phút, ${n} lượt ôn`,
    }, String(new Date(t).getDate())));
  }
  const thisWeek = cells.slice(28).map((c, i) => h('span', { class: ['wk-dot', /l[1-4]/.test(c.className) ? 'on' : '', i === dow ? 'today' : ''] }, WD[i]));

  const goalFrac = Math.min(1, totals.today / (s.session_minutes * 60000));
  const ring = scoreRing(goalFrac, { size: 120, stroke: 12, passed: goalFrac >= 1 ? true : null });
  ring.querySelector('text').textContent = `${minutes(totals.today)}′`;
  ring.setAttribute('aria-label', `Hôm nay ${minutes(totals.today)}/${s.session_minutes} phút`);

  const learnedTotal = counts.learning + counts.mastered;
  const seg = (n, cls) => (n ? h('span', { class: cls, style: { flexGrow: String(n) } }) : null);

  const tile = (v, l, ic) => h('div', { class: 'tile px-box' }, h('div', { class: 'tile-ic' }, icon(ic)), h('div', { class: 'value' }, v), h('div', { class: 'label' }, l));

  mount(root,
    h('div', { class: 'large-title' }, h('div', {}, h('div', { class: 'sub' }, 'Tiến độ của bạn'), h('h1', {}, 'Thống kê'))),
    h('div', { class: 'stats-layout' },
      h('div', { class: 'stats-left' }, h('section', { class: 'hero px-box stats-hero' },
        h('div', { class: 'row nowrap', style: { gap: '18px', alignItems: 'center' } },
          ring,
          h('div', { style: { flex: 1 } },
            h('div', { class: 'q-type' }, 'Hôm nay'),
            h('div', { style: { fontSize: '22px', fontWeight: 800 } }, `${minutes(totals.today)} / ${s.session_minutes} phút`),
            h('div', { class: 'streak-line' }, icon('flame'), st ? `Chuỗi ${st} ngày` : 'Bắt đầu chuỗi ngày học'))),
        h('div', { class: 'wk-row', 'aria-label': 'Các ngày đã học trong tuần này' }, thisWeek)),
        h('div', { class: 'grid stats-tiles' },
          tile(formatDuration(totals.week), '7 ngày qua', 'clock'),
          tile(formatDuration(totals.all), 'tổng thời gian', 'target'),
          tile(`${lessonsDone}/${data.lessons.length}`, 'bài hoàn thành', 'trophy'),
          tile(String(learnedTotal), 'từ đã học', 'cards'))),
      h('section', { class: 'card px-box' },
        h('div', { class: 'row between' }, h('h2', { style: { margin: 0 } }, 'Lịch học 5 tuần'), legend()),
        h('div', { class: 'hm-head' }, WD.map((d) => h('span', {}, d))),
        h('div', { class: 'heatmap' }, cells))),
    h('div', { class: 'stats-layout' },
      h('section', { class: 'card px-box' },
        h('h2', {}, 'Phút học mỗi ngày'),
        h('p', { class: 'muted small', style: { marginTop: '-6px' } }, '14 ngày gần nhất'),
        columnChart(series.map((d) => ({ label: dm(d.day), value: minutes(d.ms), tip: `${dm(d.day)}: ${minutes(d.ms)} phút` })), { caption: 'Phút học', unit: ' phút' })),
      h('section', { class: 'card px-box' },
        h('h2', {}, 'Từ vựng'),
        h('div', { class: 'stack-bar', role: 'img', 'aria-label': `Đã thuộc ${counts.mastered}, đang học ${counts.learning}, mới ${counts.new}` },
          seg(counts.mastered, 'sb-mastered'), seg(counts.learning, 'sb-learning'), seg(counts.new, 'sb-new')),
        h('div', { class: 'sb-legend' },
          legendItem('sb-mastered', 'Đã thuộc', counts.mastered),
          legendItem('sb-learning', 'Đang học', counts.learning),
          legendItem('sb-new', 'Mới', counts.new)),
        h('p', { class: 'muted small' }, '“Đã thuộc” = khoảng ôn từ 21 ngày trở lên.'),
        h('a', { class: 'btn tinted block', href: '#/cards', style: { marginTop: '6px' } }, icon('cards'), 'Xem thẻ'))),
    h('section', { class: 'card px-box', style: { marginTop: '16px' } },
      h('h2', {}, 'Tỷ lệ nhớ đúng theo tuần'),
      hbars(weeks.map((w) => ({
        label: `${dm(dayKey(w.from))}–${dm(dayKey(w.to - 1))}`,
        value: w.rate ?? 0,
        display: w.rate == null ? '—' : pct(w.rate),
      })), { total: 1 }),
      byAct.length ? h('table', { class: 'data', style: { marginTop: '12px' } },
        h('thead', {}, h('tr', {}, h('th', {}, 'Hoạt động'), h('th', { class: 'num' }, 'Lượt'), h('th', { class: 'num' }, 'Đúng'))),
        h('tbody', {}, byAct.map((a) => h('tr', {}, h('td', {}, ACTIVITY[a.activity] || a.activity), h('td', { class: 'num' }, a.total), h('td', { class: 'num' }, a.rate == null ? '—' : pct(a.rate)))))) : h('p', { class: 'muted' }, 'Chưa có lượt ôn nào.')),
  );
}

function legend() {
  return h('span', { class: 'hm-legend', 'aria-hidden': 'true' }, 'ít', [0, 1, 2, 3, 4].map((i) => h('span', { class: ['hm-cell', 'mini', `l${i}`] })), 'nhiều');
}

function legendItem(cls, label, n) {
  return h('span', { class: 'sb-item' }, h('i', { class: cls }), label, h('strong', {}, String(n)));
}
