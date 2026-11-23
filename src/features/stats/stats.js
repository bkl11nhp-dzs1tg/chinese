// Trang Thống kê (mục 9.9).

import { h, mount, pct } from '../../ui/dom.js';
import { icon } from '../../ui/icons.js';
import { columnChart, hbars } from '../../ui/chart.js';
import { dayKey, dailySeries, timeTotals, streak, cardStatusCounts, weeklyAccuracy, accuracyByActivity, formatDuration } from '../../core/stats.js';

const ACTIVITY = { review: 'Ôn thẻ', new: 'Thẻ mới', relearn: 'Ôn lại trong buổi', exercise: 'Bài tập', game: 'Trò chơi' };

export async function render(root, ctx) {
  const now = Date.now();
  const [data, sessions, events] = await Promise.all([ctx.loadAll(), ctx.repo.getAll('study_sessions'), ctx.repo.getAll('review_events')]);
  const totals = timeTotals(sessions, now);
  const series = dailySeries(sessions, now, 14);
  const counts = cardStatusCounts(data.cards, data.statesById);
  const weeks = weeklyAccuracy(events, now, 4);
  const byAct = accuracyByActivity(events);
  const lessonsDone = data.lessons.filter((l) => data.statusById.get(l.id).status === 'done').length;
  const tile = (v, l, ic) => h('div', { class: 'tile px-box' }, ic ? h('div', { class: 'tile-ic' }, icon(ic)) : null, h('div', { class: 'value' }, v), h('div', { class: 'label' }, l));
  const dm = (d) => { const [, m, dd] = d.split('-'); return `${Number(dd)}/${Number(m)}`; };
  const minutes = (ms) => Math.round(ms / 60000);

  mount(root,
    h('div', { class: 'large-title' }, h('h1', {}, 'Thống kê')),
    h('div', { class: 'grid' },
      tile(formatDuration(totals.today), 'hôm nay', 'clock'),
      tile(formatDuration(totals.week), '7 ngày qua', 'today'),
      tile(formatDuration(totals.all), 'tổng thời gian', 'target'),
      tile(streak(sessions, now) ? `${streak(sessions, now)} ngày` : '—', 'chuỗi ngày học', 'flame'),
      tile(`${lessonsDone}/${data.lessons.length}`, 'bài đã xong', 'trophy'),
      tile(counts.mastered, 'từ đã thuộc', 'star')),
    h('section', { class: 'card px-box', style: { marginTop: '24px' } },
      h('h2', {}, 'Phút học mỗi ngày (14 ngày)'),
      columnChart(series.map((d) => ({ label: dm(d.day), value: minutes(d.ms), tip: `${dm(d.day)}: ${minutes(d.ms)} phút` })), { caption: 'Phút học', unit: ' phút' })),
    h('section', { class: 'card px-box', style: { marginTop: '24px' } },
      h('h2', {}, 'Từ vựng theo trạng thái'),
      hbars([
        { label: 'Đã thuộc', value: counts.mastered },
        { label: 'Đang học', value: counts.learning },
        { label: 'Mới', value: counts.new },
      ], { total: Math.max(1, data.cards.length) }),
      h('p', { class: 'muted small' }, '"Đã thuộc" = khoảng ôn từ 21 ngày trở lên.')),
    h('section', { class: 'card px-box', style: { marginTop: '24px' } },
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
