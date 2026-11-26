// Trang Thống kê (mục 9.9): tổng quan hôm nay + chuỗi ngày, lịch hoạt động 5 tuần,
// số liệu chính, phút học 14 ngày, từ vựng theo trạng thái, tỷ lệ nhớ đúng.

import { h, mount, pct } from '../../ui/dom.js';
import { icon } from '../../ui/icons.js';
import { dayKey, dailySeries, timeTotals, streak, cardStatusCounts, weeklyAccuracy, accuracyByActivity, formatDuration, startOfDay, addDays } from '../../core/stats.js';
import { scoreRing } from '../exercises/result-view.js';

const ACTIVITY = { review: 'Ôn thẻ', new: 'Thẻ mới', relearn: 'Ôn lại trong buổi', exercise: 'Bài tập', game: 'Trò chơi', practice: 'Luyện kỹ năng', 'recall-write': 'Tự viết', 'recall-listen': 'Nghe viết', 'recall-pinyin': 'Viết từ pinyin', 'recall-missing': 'Điền chữ thiếu', 'recall-review': 'Nhớ từ cũ', 'recall-compose': 'Cấu tạo chữ', 'recall-sentence': 'Đặt câu' };
const MEM_SKILLS = [
  ['Nhận mặt chữ (thẻ)', ['review', 'new', 'relearn'], 'cards'],
  ['Tự viết từ nghĩa', ['recall-write'], 'pencil'],
  ['Viết từ pinyin', ['recall-pinyin', 'recall-missing'], 'keyboard'],
  ['Nghe rồi viết', ['recall-listen'], 'headphones'],
  ['Nhớ từ cũ', ['recall-review'], 'repeat'],
  ['Cấu tạo chữ', ['recall-compose'], 'blocks'],
  ['Đặt câu', ['recall-sentence'], 'chat'],
  ['Bài tập & luyện kỹ năng', ['exercise', 'practice', 'game'], 'target'],
];
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
      // 1. Phút học 7 ngày gần nhất: cột HTML, số phút trên đầu cột, thứ ở dưới.
      (() => {
        const last7 = series.slice(-7);
        const mins = last7.map((d) => minutes(d.ms));
        const max = Math.max(s.session_minutes * 1.25, ...mins, 1);
        const total = mins.reduce((a, b) => a + b, 0);
        return h('section', { class: 'card px-box st-card' },
          h('div', { class: 'st-head' }, h('h2', {}, 'Phút học 7 ngày'), h('span', { class: 'st-sum' }, h('b', {}, `${total}′`), ` · TB ${Math.round(total / 7)}′/ngày`)),
          h('div', { class: 'days-chart', role: 'img', 'aria-label': last7.map((d, i) => `${dm(d.day)}: ${mins[i]} phút`).join(', ') },
            h('i', { class: 'goal-line', style: { bottom: `${(s.session_minutes / max) * 100}%` } }),
            last7.map((d, i) => {
              const date = new Date(d.day);
              const today = i === last7.length - 1;
              return h('div', { class: ['dc-col', today ? 'today' : '', mins[i] >= s.session_minutes ? 'hit' : ''] },
                h('span', { class: 'dc-val' }, mins[i] ? String(mins[i]) : ''),
                h('span', { class: 'dc-bar', style: { height: `${Math.max(mins[i] ? 6 : 3, (mins[i] / max) * 100)}%` } }),
                h('span', { class: 'dc-day' }, today ? 'Nay' : WD[(date.getDay() + 6) % 7]));
            })));
      })(),
      // 2. Từ vựng: thanh tỉ lệ dày + 3 ô số.
      h('section', { class: 'card px-box st-card' },
        h('div', { class: 'st-head' }, h('h2', {}, 'Từ vựng'), h('span', { class: 'st-sum' }, h('b', {}, String(learnedTotal)), `/${data.cards.length} đã học`)),
        h('div', { class: 'stack-bar big', role: 'img', 'aria-label': `Đã thuộc ${counts.mastered}, đang học ${counts.learning}, mới ${counts.new}` },
          seg(counts.mastered, 'sb-mastered'), seg(counts.learning, 'sb-learning'), seg(counts.new, 'sb-new')),
        h('div', { class: 'vocab-stats' },
          [['sb-mastered', 'Đã thuộc', counts.mastered, 'mastered'], ['sb-learning', 'Đang học', counts.learning, 'learning'], ['sb-new', 'Chưa học', counts.new, 'new']]
            .map(([cls, label, n, k]) => h('a', { class: 'vs-item', href: `#/cards?s=${k}` }, h('i', { class: cls }), h('b', {}, String(n)), h('small', {}, label)))),
        h('a', { class: 'btn tinted block', href: '#/cards' }, icon('cards'), 'Xem thẻ')),
    ),
    // 3. Tỷ lệ nhớ đúng 4 tuần: mỗi tuần một cột phần trăm.
    h('section', { class: 'card px-box st-card', style: { marginTop: '16px' } },
      h('div', { class: 'st-head' }, h('h2', {}, 'Tỷ lệ nhớ đúng'), h('span', { class: 'st-sum' }, '4 tuần gần nhất')),
      h('div', { class: 'acc-weeks' }, weeks.map((w, i) => h('div', { class: ['aw-col', w.rate == null ? 'empty' : w.rate >= 0.8 ? 'good' : w.rate >= 0.5 ? 'mid' : 'low', i === weeks.length - 1 ? 'now' : ''] },
        h('div', { class: 'aw-track' }, h('span', { style: { height: `${Math.round((w.rate ?? 0) * 100)}%` } })),
        h('b', {}, w.rate == null ? '–' : pct(w.rate)),
        h('small', {}, i === weeks.length - 1 ? 'Tuần này' : `${dm(dayKey(w.from))}`)))),
      byAct.length ? h('div', { class: 'act-chips' }, byAct.map((a) => h('span', { class: 'act-chip' }, ACTIVITY[a.activity] || a.activity, h('b', {}, a.rate == null ? '—' : pct(a.rate)), h('small', {}, `${a.total} lượt`)))) : null),
    // Khả năng ghi nhớ theo từng kỹ năng (đúng/sai, số lượt).
    h('section', { class: 'card px-box st-card', style: { marginTop: '16px' } },
      h('div', { class: 'st-head' }, h('h2', {}, 'Khả năng ghi nhớ'), h('span', { class: 'st-sum' }, 'theo kỹ năng')),
      h('div', { class: 'mem-skills' }, MEM_SKILLS.map(([label, acts, ic]) => {
        const rows = byAct.filter((a) => acts.includes(a.activity));
        const total = rows.reduce((n, a) => n + a.total, 0);
        const right = rows.reduce((n, a) => n + a.correct, 0);
        const rate = total ? right / total : null;
        return h('div', { class: ['mem-row', rate == null ? 'empty' : rate >= 0.8 ? 'good' : rate >= 0.5 ? 'mid' : 'low'] },
          h('span', { class: 'mem-ic' }, icon(ic)),
          h('div', { class: 'mem-main' },
            h('div', { class: 'mem-top' }, h('b', {}, label), h('span', {}, rate == null ? 'chưa luyện' : pct(rate))),
            h('div', { class: 'mem-bar' }, h('i', { style: { width: `${Math.round((rate ?? 0) * 100)}%` } })),
            total ? h('small', {}, `${total} lượt · sai ${total - right}`) : null));
      }))),
  );
}

function legend() {
  return h('span', { class: 'hm-legend', 'aria-hidden': 'true' }, 'ít', [0, 1, 2, 3, 4].map((i) => h('span', { class: ['hm-cell', 'mini', `l${i}`] })), 'nhiều');
}

function legendItem(cls, label, n) {
  return h('span', { class: 'sb-item' }, h('i', { class: cls }), label, h('strong', {}, String(n)));
}
