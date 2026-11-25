-- Đăng ký nhận thông báo nhắc học (Web Push). Mỗi máy một endpoint.
CREATE TABLE IF NOT EXISTS push_subs (
  endpoint TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  remind_utc_min INTEGER NOT NULL,   -- phút trong ngày theo giờ UTC (0–1439)
  tz_offset_min INTEGER NOT NULL,    -- độ lệch múi giờ của máy (phút, như Date#getTimezoneOffset đổi dấu: GMT+7 = 420)
  last_sent_day TEXT,                -- ngày (theo giờ máy) đã gửi gần nhất, để mỗi ngày gửi tối đa 1 lần
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS push_subs_user ON push_subs(user_id);
