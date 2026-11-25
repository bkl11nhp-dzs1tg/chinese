// Đồng bộ 2 thiết bị qua server thật (handler của Worker + SQLite trong bộ nhớ).
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { handle } from '../worker/src/handler.js';
import { createD1 } from '../worker/d1-node.js';
import { openDb, createRepo } from '../src/db/repo.js';
import { signIn, syncNow, signOut, loadAccount, deleteAccount } from '../src/sync.js';
import { mergeRecord } from '../src/core/syncmerge.js';

const URL0 = 'http://sync.test';
let env;
let n = 0;
const store = new Map();
globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
const fetchImpl = (url, init) => handle(new Request(url, init), env);
const device = async () => createRepo(await openDb({ name: `dev-${n++}` }));
// Mỗi "thiết bị" có localStorage riêng: lưu/khôi phục tài khoản khi chuyển máy.
const as = async (acct, fn) => { store.set('chinese-study-account', JSON.stringify(acct)); const r = await fn(); return [r, JSON.parse(store.get('chinese-study-account') || 'null')]; };

beforeEach(() => {
  env = { DB: createD1(':memory:', ['worker/migrations/0001_init.sql', 'worker/migrations/0002_push.sql']), ALLOWED_ORIGINS: '*' };
  store.clear();
});

describe('server tài khoản', () => {
  it('đăng ký, đăng nhập, sai mật khẩu, trùng tên, chưa đăng nhập', async () => {
    await signIn({ url: URL0, username: 'linh', password: 'matkhau123', register: true, fetchImpl });
    expect(loadAccount().username).toBe('linh');
    await expect(signIn({ url: URL0, username: 'linh', password: 'matkhau123', register: true, fetchImpl })).rejects.toThrow(/đã có/);
    await expect(signIn({ url: URL0, username: 'linh', password: 'sai-mat-khau', fetchImpl })).rejects.toThrow(/Sai/);
    await expect(signIn({ url: URL0, username: 'linh', password: 'ngan', register: true, fetchImpl })).rejects.toThrow();
    const r = await fetchImpl(`${URL0}/api/sync/pull?cursor=0`, {});
    expect(r.status).toBe(401);
  });

  it('khóa tạm sau 10 lần đăng nhập sai', async () => {
    await signIn({ url: URL0, username: 'anna', password: 'matkhau123', register: true, fetchImpl });
    for (let i = 0; i < 10; i++) await signIn({ url: URL0, username: 'anna', password: 'xxxxxxxx', fetchImpl }).catch(() => {});
    await expect(signIn({ url: URL0, username: 'anna', password: 'matkhau123', fetchImpl })).rejects.toThrow(/quá nhiều/);
  });
});

describe('đồng bộ 2 thiết bị', () => {
  it('học trên máy A → máy B nhận được; gộp tiến độ; không trùng sự kiện; xóa được đồng bộ', async () => {
    const A = await device();
    const B = await device();
    const acctA = await signIn({ url: URL0, username: 'linh', password: 'matkhau123', register: true, fetchImpl });
    const T = 1_700_000_000_000;
    const r1 = await A.recordReview({ cardId: 'L01-你', quality: 4, activity: 'new', now: T });
    await A.saveTestScore('L01', 0.8, T);
    await A.saveSettings({ new_per_day: 15, content_version: 'abc' }, T);
    await A.saveReadingWord({ hanzi: '同事', pinyin: 'tóngshì', meaning: 'đồng nghiệp', readingId: 'R02', sentenceIndex: 3, now: T });
    let [res, a1] = await as(acctA, () => syncNow(A, { fetchImpl }));
    expect(res.status).toBe('ok');
    expect(res.pushed).toBeGreaterThanOrEqual(5);

    // Máy B đăng nhập cùng tài khoản, đã có tiến độ riêng
    store.delete('chinese-study-account');
    const acctB = await signIn({ url: URL0, username: 'linh', password: 'matkhau123', fetchImpl });
    await B.saveTestScore('L01', 0.6, T + 1000);
    await B.saveTestScore('L02', 0.9, T + 1000);
    let b1;
    [res, b1] = await as(acctB, () => syncNow(B, { fetchImpl }));
    expect((await B.get('card_state', 'L01-你')).repetitions).toBe(1);
    expect((await B.get('lesson_progress', 'L01')).test_best).toBe(0.8);
    expect((await B.get('lesson_progress', 'L01')).test_attempts).toBe(1);
    expect((await B.getSettings()).new_per_day).toBe(15);
    expect((await B.getSettings()).content_version).not.toBe('abc'); // cài đặt riêng máy không đồng bộ
    expect((await B.get('cards', 'RD-同事')).meaning).toBe('đồng nghiệp');
    expect(await B.count('review_events')).toBe(1);

    // A nhận L02 của B; đồng bộ lại không tạo bản trùng
    let a2;
    [res, a2] = await as(a1, () => syncNow(A, { fetchImpl }));
    expect((await A.get('lesson_progress', 'L02')).test_best).toBe(0.9);
    [res] = await as(a2, () => syncNow(A, { fetchImpl }));
    expect(res.pushed).toBe(0);
    expect(await A.count('review_events')).toBe(1);

    // Xóa (hoàn tác lần chấm) trên A → B cũng mất
    await A.undoReview({ cardId: 'L01-你', previous: r1.previous, eventId: r1.event.id });
    await as(a2, () => syncNow(A, { fetchImpl }));
    await as(b1, () => syncNow(B, { fetchImpl }));
    expect(await B.get('card_state', 'L01-你')).toBeUndefined();
    expect(await B.count('review_events')).toBe(0);
  });

  it('đăng xuất thì không đồng bộ; xóa tài khoản xóa dữ liệu trên server', async () => {
    const A = await device();
    await signIn({ url: URL0, username: 'mai', password: 'matkhau123', register: true, fetchImpl });
    await A.saveTestScore('L01', 1, 1);
    await syncNow(A, { fetchImpl });
    await deleteAccount(A, 'matkhau123', { fetchImpl });
    expect(loadAccount()).toBeNull();
    expect((await syncNow(A, { fetchImpl })).status).toBe('signed-out');
    await expect(signIn({ url: URL0, username: 'mai', password: 'matkhau123', fetchImpl })).rejects.toThrow();
    await signOut(A, { fetchImpl });
  });
});

describe('luật gộp', () => {
  it('card_state lấy lần ôn mới hơn; lesson_progress lấy mức cao nhất', () => {
    expect(mergeRecord('card_state', { last_reviewed_at: 5, interval_days: 1 }, { last_reviewed_at: 9, interval_days: 6 }).interval_days).toBe(6);
    const m = mergeRecord('lesson_progress', { status: 'done', best_score: 0.5, attempts: 2, updated_at: 1 }, { status: 'doing', best_score: 0.9, attempts: 1, test_best: 0.7, updated_at: 2 });
    expect(m).toMatchObject({ status: 'done', best_score: 0.9, attempts: 2, test_best: 0.7 });
  });
});

describe('đánh dấu từ (known_words)', () => {
  it('lấy bản đánh dấu mới hơn: chưa nhớ → đã nhớ', () => {
    const a = { word: '老师', status: 'weak', marked_at: 100 };
    const b = { word: '老师', status: 'known', marked_at: 200 };
    expect(mergeRecord('known_words', a, b).status).toBe('known');
    expect(mergeRecord('known_words', b, a).status).toBe('known');
  });
});

describe('máy chủ cũ', () => {
  it('máy chủ chưa nhận "readings" vẫn đăng nhập/đồng bộ được', async () => {
    const { createD1 } = await import('../worker/d1-node.js');
    const { handle } = await import('../worker/src/handler.js');
    const env = { DB: createD1(':memory:', ['worker/migrations/0001_init.sql', 'worker/migrations/0002_push.sql']), ALLOWED_ORIGINS: '*' };
    // Giả lập máy chủ cũ: từ chối mọi lần đẩy có store "readings".
    const fetchImpl = async (url, init) => {
      if (url.endsWith('/api/sync/push') && JSON.parse(init.body).changes.some((c) => c.store === 'readings')) {
        return new Response(JSON.stringify({ error: 'Bản ghi không hợp lệ.' }), { status: 400 });
      }
      return handle(new Request(url, init), env);
    };
    const { openDb: open, createRepo: mk } = await import('../src/db/repo.js');
    const repo = mk(await open(`old-${Math.random()}`));
    await repo.saveUserReading({ id: 'U-1', title: 'x', kind: 'song', paragraphs: [{ id: 'p1', sentences: [{ id: 's1', hanzi: '你好' }] }] });
    await repo.saveSettings({ theme: 'dark' });
    await signIn({ url: 'http://x', username: 'olduser', password: 'matkhau123', register: true, fetchImpl });
    const r = await syncNow(repo, { fetchImpl });
    expect(r.status).toBe('ok');
    await signOut(repo, { fetchImpl });
  });
});
