// Ghi kết quả từng câu vào review_events để thống kê "Khả năng ghi nhớ" và tỷ lệ nhớ đúng luôn cập nhật.
// Câu gắn với từ: ghi theo từng từ (mode quyết định có đổi lịch ôn hay không). Câu không gắn từ: ghi một lượt chung.

/**
 * @param {object} repo
 * @param {Array<string>} cardIds  từ liên quan (có thể rỗng)
 * @param {boolean} ok
 * @param {{activity:string, sessionId?:string, mode?:'light'|'log'|'full'}} o
 *   mode 'light': từ đã học được cập nhật nhẹ lịch ôn; 'log': chỉ ghi lượt, không đổi lịch ôn.
 */
export async function recordAnswer(repo, cardIds, ok, { activity, sessionId = null, mode = 'light' }) {
  const quality = ok ? 4 : 2;
  const ids = [...new Set(cardIds || [])].filter(Boolean);
  if (!ids.length) return repo.logActivity({ activity, quality, sessionId });
  for (const id of ids) await repo.recordReview({ cardId: id, quality, activity, sessionId, mode });
}
