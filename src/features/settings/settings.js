// Cài đặt (mục 9.10): thông số học, nội dung (tự lấy từ data/), xuất/khôi phục dữ liệu, xóa dữ liệu.

import { h, mount, toast, confirmDialog, downloadFile, readFileText } from '../../ui/dom.js';
import { syncContent } from '../../content.js';
import { loadAccount, resetSyncState } from '../../sync.js';
import { toCsv } from '../../core/csv.js';
import { applyTheme } from '../../app.js';
import { chineseVoice, ttsSupported } from '../../ui/speech.js';
import { setFeedbackEnabled } from '../../ui/feedback.js';
import { icon } from '../../ui/icons.js';

export async function render(root, ctx) {
  const s = ctx.settings;
  const repo = ctx.repo;
  const counts = {
    cards: await repo.count('cards'), lessons: await repo.count('lessons'), exercises: await repo.count('exercises'), readings: await repo.count('readings'),
    events: await repo.count('review_events'),
  };
  const voice = ttsSupported() ? await chineseVoice() : null;

  const save = async (patch, msg = 'Đã lưu') => {
    await repo.saveSettings(patch);
    await ctx.refreshSettings();
    setFeedbackEnabled(ctx.settings.sound_enabled);
    toast(msg);
  };
  const numberRow = (key, label, hint, { min, max, step = 1 }) => h('div', { class: 'form-row' },
    h('label', { for: `set-${key}` }, label, hint ? h('span', { class: 'hint' }, hint) : null),
    h('input', { id: `set-${key}`, type: 'number', min, max, step, value: String(s[key]),
      onchange: (e) => { const v = Number(e.target.value); if (v >= min && v <= max) save({ [key]: v }); else e.target.value = s[key]; } }));
  const selectRow = (key, label, hint, options, parse = (v) => v) => h('div', { class: 'form-row' },
    h('label', { for: `set-${key}` }, label, hint ? h('span', { class: 'hint' }, hint) : null),
    h('select', { id: `set-${key}`, onchange: (e) => { save({ [key]: parse(e.target.value) }); if (key === 'theme') applyTheme(e.target.value); } },
      options.map(([v, t]) => h('option', { value: String(v), selected: String(s[key]) === String(v) }, t))));
  const switchRow = (key, label, hint) => h('div', { class: 'form-row' },
    h('label', { for: `set-${key}` }, label, hint ? h('span', { class: 'hint' }, hint) : null),
    h('div', {}, h('input', { id: `set-${key}`, type: 'checkbox', class: 'switch', checked: !!s[key], onchange: (e) => save({ [key]: e.target.checked }) })));

  // ---------- Xuất / khôi phục / xóa
  async function exportJson() {
    const data = await repo.exportAll();
    const d = new Date();
    const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    downloadFile(`chinese-study-backup-${stamp}.json`, JSON.stringify(data));
    await repo.saveSettings({ last_export_at: Date.now() });
    await ctx.refreshSettings();
    toast('Đã xuất bản sao lưu.');
  }
  async function exportCsv() {
    const [cards, states] = await Promise.all([repo.getAll('cards'), repo.getAll('card_state')]);
    const byId = new Map(states.map((x) => [x.card_id, x]));
    const rows = cards.map((c) => {
      const st = byId.get(c.id) || {};
      return { ...c, interval_days: st.interval_days ?? '', repetitions: st.repetitions ?? '', lapses: st.lapses ?? '', due_at: st.due_at ? new Date(st.due_at).toISOString() : '' };
    });
    downloadFile('chinese-study-cards.csv', `﻿${toCsv(['id', 'hanzi', 'pinyin', 'meaning', 'hsk_level', 'lesson_id', 'tags', 'interval_days', 'repetitions', 'lapses', 'due_at'], rows)}`, 'text/csv');
  }
  const restoreInput = h('input', { type: 'file', accept: '.json', class: 'hidden', onchange: async () => {
    const f = restoreInput.files[0];
    restoreInput.value = '';
    if (!f) return;
    let data;
    try { data = JSON.parse(await readFileText(f)); } catch { toast('File không phải JSON hợp lệ.'); return; }
    if (data.format !== 'chinese-study-backup') { toast('Không phải file sao lưu của app.'); return; }
    const ok = await confirmDialog({
      title: 'Khôi phục bản sao lưu?',
      body: `Toàn bộ dữ liệu hiện tại (trừ file nghe) sẽ được thay bằng bản sao lưu ngày ${new Date(data.exported_at).toLocaleString('vi-VN')}: ${data.cards?.length || 0} từ, ${data.review_events?.length || 0} lượt ôn.`,
      ok: 'Khôi phục', danger: true,
    });
    if (!ok) return;
    await repo.restoreBackup(data);
    await ctx.refreshSettings();
    toast('Đã khôi phục.');
    ctx.navigate('today');
  } });
  async function wipe() {
    const first = await confirmDialog({ title: 'Xóa toàn bộ dữ liệu?', body: loadAccount() ? 'Xóa dữ liệu học trong trình duyệt này. Vì đang đăng nhập, lần đồng bộ sau sẽ tải lại tiến độ từ máy chủ (muốn xóa cả trên máy chủ: Tài khoản → Xóa tài khoản).' : 'Xóa mọi tiến độ, lịch ôn, thời gian học, từ tự lưu trong trình duyệt này (nội dung bài học sẽ được nạp lại). Không thể hoàn tác. Nên xuất bản sao lưu trước.', ok: 'Tiếp tục', danger: true });
    if (!first) return;
    const input = h('input', { type: 'text', 'aria-label': 'Gõ XÓA để xác nhận', placeholder: 'XÓA', autocomplete: 'off' });
    const second = await confirmDialog({ title: 'Xác nhận lần hai', body: h('div', {}, h('p', {}, 'Gõ chữ XÓA để xác nhận.'), input), ok: 'Xóa vĩnh viễn', danger: true });
    if (!second) return;
    if (input.value.trim().toUpperCase() !== 'XÓA' && input.value.trim().toUpperCase() !== 'XOA') { toast('Chưa gõ đúng chữ XÓA, đã hủy.'); return; }
    await repo.clearAll();
    await resetSyncState(repo);
    await syncContent(repo, await ctx.refreshSettings());
    await ctx.refreshSettings();
    toast('Đã xóa toàn bộ tiến độ; nội dung bài học được nạp lại.');
    ctx.navigate('today');
  }

  mount(root,
    h('div', { class: 'large-title' }, h('h1', {}, 'Cài đặt')),
    h('a', { class: 'group row-link account-row', href: '#/account' },
      h('span', { class: 'icon-box' }, icon(loadAccount() ? 'cloudCheck' : 'user')),
      h('span', { class: 'grow' },
        h('div', { class: 'title' }, loadAccount() ? `Tài khoản: ${loadAccount().username}` : 'Tài khoản & đồng bộ'),
        h('div', { class: 'meta' }, loadAccount() ? 'Đang đồng bộ giữa các thiết bị' : 'Đăng nhập để học trên nhiều thiết bị')),
      icon('chevron')),
    h('a', { class: 'group row-link account-row', href: '#/welcome' },
      h('span', { class: 'icon-box' }, icon('download')),
      h('span', { class: 'grow' }, h('div', { class: 'title' }, 'Giới thiệu & cài app'), h('div', { class: 'meta' }, 'Cài lên màn hình chính để mở nhanh')),
      icon('chevron')),
    h('div', { class: 'section-title' }, 'Học tập'),
    h('section', { class: 'group' },
      numberRow('new_per_day', 'Số từ mới mỗi ngày', 'Mặc định 10', { min: 0, max: 100 }),
      selectRow('session_minutes', 'Thời lượng buổi học', 'Planner giữ tổng thời gian trong khoảng này', [[10, '10 phút'], [15, '15 phút'], [20, '20 phút'], [30, '30 phút']], Number),
      selectRow('pass_threshold', 'Ngưỡng hoàn thành bài', 'Điểm bài tập tối thiểu', [[0.6, '60%'], [0.7, '70%'], [0.8, '80%'], [0.9, '90%']], Number),
      selectRow('idle_minutes', 'Ngừng tính giờ khi không thao tác', 'Idle cutoff', [[1, '1 phút'], [2, '2 phút'], [3, '3 phút'], [5, '5 phút']], Number),
      switchRow('show_pinyin_front', 'Hiện bính âm ở mặt trước thẻ', 'Tắt để tự nhớ cách đọc'),
      switchRow('sound_enabled', 'Âm báo & rung', 'Khi trả lời đúng/sai'),
      switchRow('games_enabled', 'Trò chơi cuối buổi học', 'Một trò nối cặp ngắn'),
      selectRow('tts_rate', 'Tốc độ đọc', voice ? `Giọng: ${voice.name}` : 'Thiết bị chưa có giọng đọc tiếng Trung', [[0.7, '0.7× (chậm)'], [0.85, '0.85×'], [1, '1×']], Number),
      h('div', { class: 'form-row' }, h('label', { for: 'set-reminder' }, 'Giờ nhắc học', h('span', { class: 'hint' }, 'Dùng khi tích hợp Telegram (giai đoạn 4)')),
        h('input', { id: 'set-reminder', type: 'time', value: s.reminder_time, onchange: (e) => save({ reminder_time: e.target.value }) })),
      switchRow('cat_enabled', 'Mèo thư ký (XP)', s.cat_enabled ? `Tổng ${s.xp_total || 0} XP` : 'Cộng XP theo thời gian học (thử nghiệm)'),
      selectRow('theme', 'Giao diện', null, [['auto', 'Theo hệ thống'], ['light', 'Sáng'], ['dark', 'Tối']])),

    h('section', { class: 'card px-box stack', style: { marginTop: '24px' } },
      h('h2', {}, 'Nội dung'),
      h('p', {}, `${counts.cards} từ · ${counts.lessons} bài · ${counts.readings} bài đọc. Nội dung tự cập nhật khi có bản mới; tiến độ học được giữ nguyên.`),
      h('div', { class: 'row' }, h('button', {
        class: 'btn', type: 'button',
        onclick: async () => {
          await repo.saveSettings({ content_version: null });
          const r = await syncContent(repo, await ctx.refreshSettings());
          await ctx.refreshSettings();
          toast(r.status === 'missing' ? 'Không tải được nội dung.' : r.status === 'offline' ? 'Đang offline, thử lại sau.' : 'Đã cập nhật nội dung.');
          ctx.navigate(`settings?r=${Date.now()}`);
        },
      }, icon('refresh'), 'Cập nhật lại nội dung'))),

    h('section', { class: 'card px-box stack', style: { marginTop: '24px' } },
      h('h2', {}, 'Dữ liệu của bạn'),
      h('p', { class: 'muted small' }, s.last_export_at ? `Lần sao lưu gần nhất: ${new Date(s.last_export_at).toLocaleString('vi-VN')}` : 'Chưa sao lưu lần nào. Dữ liệu chỉ nằm trong trình duyệt này.'),
      h('div', { class: 'row' },
        h('button', { class: 'btn', type: 'button', onclick: exportJson }, icon('download'), 'Xuất bản sao lưu'),
        h('button', { class: 'btn ghost', type: 'button', onclick: exportCsv }, icon('download'), 'Xuất danh sách từ'),
        h('button', { class: 'btn ghost', type: 'button', onclick: () => restoreInput.click() }, icon('upload'), 'Khôi phục từ sao lưu'),
        restoreInput),
      h('div', { class: 'row' }, h('button', { class: 'btn danger', type: 'button', onclick: wipe }, icon('trash'), 'Xóa toàn bộ dữ liệu'))),
  );
}
