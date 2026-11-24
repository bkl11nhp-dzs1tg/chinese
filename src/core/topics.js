// Chủ đề từ vựng (cột topic trong data/vocab/*.csv).
export const TOPICS = [
  { id: 'greet', label: 'Giao tiếp' },
  { id: 'people', label: 'Con người' },
  { id: 'numbers', label: 'Số & lượng từ' },
  { id: 'time', label: 'Thời gian' },
  { id: 'food', label: 'Ăn uống' },
  { id: 'shopping', label: 'Mua sắm' },
  { id: 'school', label: 'Học tập' },
  { id: 'places', label: 'Nơi chốn' },
  { id: 'travel', label: 'Đi lại & liên lạc' },
  { id: 'work', label: 'Công việc' },
  { id: 'health', label: 'Sức khỏe' },
  { id: 'hobby', label: 'Sở thích' },
  { id: 'daily', label: 'Sinh hoạt' },
  { id: 'countries', label: 'Quốc gia & tên riêng' },
  { id: 'things', label: 'Đồ vật' },
  { id: 'verbs', label: 'Động từ' },
  { id: 'adj', label: 'Tính chất' },
  { id: 'func', label: 'Từ ngữ pháp' },
];
export const topicLabel = (id) => TOPICS.find((t) => t.id === id)?.label || 'Khác';
