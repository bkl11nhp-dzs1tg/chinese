// Giá trị mặc định của cài đặt (mục 9.10).
export const DEFAULT_SETTINGS = Object.freeze({
  new_per_day: 10,
  session_minutes: 20,
  reminder_time: '20:00',
  reminder_enabled: false,
  cat_enabled: false,
  games_enabled: true,
  tts_rate: 1,
  pass_threshold: 0.7,
  idle_minutes: 2,
  active_lesson_id: null,
  theme: 'auto', // auto | light | dark
  show_pinyin_front: false,
  sound_enabled: true,
});

export function withDefaults(stored = {}) {
  return { ...DEFAULT_SETTINGS, ...stored };
}
