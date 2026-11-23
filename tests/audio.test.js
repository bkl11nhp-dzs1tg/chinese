import { describe, it, expect } from 'vitest';
import { lessonIdFromAudioName } from '../src/core/audio.js';

describe('lessonIdFromAudioName', () => {
  it('đọc số bài từ tên file', () => {
    expect(lessonIdFromAudioName('Quyển 1 Bài 3.mp3')).toBe('L03');
    expect(lessonIdFromAudioName('Quyển 2 Bài 16.mp3')).toBe('L16');
    expect(lessonIdFromAudioName('Quyê\u0300n 1 Ba\u0300i 7.mp3')).toBe('L07'); // tên file dạng NFD
    expect(lessonIdFromAudioName('L5.mp3')).toBe('L05');
    expect(lessonIdFromAudioName('lesson 12.mp3')).toBe('L12');
    expect(lessonIdFromAudioName('intro.mp3')).toBe(null);
  });
});
