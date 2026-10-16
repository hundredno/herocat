import { describe, expect, it } from 'vitest';
import { SPEED_PRESETS, SpeedControl, chapterList, clock, soundsForVideo, storyBeats, videoTime } from '../scripts/record/cuts.js';

describe('recording: playback speed', () => {
  it('speeds up gently while farming and drops back to 1× for notable moments', () => {
    const sc = new SpeedControl(SPEED_PRESETS.youtube);
    const seen = [];
    for (let i = 0; i < 40; i++) seen.push(sc.next('farm', 100 + i, 0));
    expect(seen[0]).toBe(1);
    expect(Math.max(...seen)).toBe(6);
    expect(seen.indexOf(6)).toBeGreaterThan(15); // ~0.33 s of video to ramp up
    expect(sc.next('farm', 200, 199)).toBeLessThan(6); // a toast just appeared
    for (let i = 0; i < 6; i++) sc.next('farm', 200, 199);
    expect(sc.next('farm', 200, 199)).toBe(1);
    expect(new SpeedControl(SPEED_PRESETS.youtube).next('story', 0, -99)).toBe(1);
  });

  it('fast-forwards post-game farming the most', () => {
    const sc = new SpeedControl(SPEED_PRESETS.youtube);
    let v = 1;
    for (let i = 0; i < 80; i++) v = sc.next('farm', 100, 0, true);
    expect(v).toBe(14);
  });
});

describe('recording: timelines', () => {
  const frames = [0, 1 / 60, 2 / 60, 10 / 60, 18 / 60]; // two frames at 1×, two at 8×

  it('maps game time onto video time', () => {
    expect(videoTime(frames, 60, 0)).toBe(0);
    expect(videoTime(frames, 60, 1 / 60)).toBeCloseTo(1 / 60);
    expect(videoTime(frames, 60, 6 / 60)).toBeCloseTo(2.5 / 60);
    expect(videoTime(frames, 60, 99)).toBeCloseTo(4 / 60);
  });

  it('thins busy sounds while fast-forwarding but keeps rewards', () => {
    const sounds = [
      { t: 0.001, name: 'swing' },
      { t: 0.18, name: 'swing' },
      { t: 0.19, name: 'coin' },
      { t: 0.2, name: 'coin' },
      { t: 0.21, name: 'levelUp' },
    ];
    const kept = soundsForVideo(sounds, frames, 60, (t) => (t > 2 / 60 ? 8 : 1));
    expect(kept.map((s) => s.name)).toEqual(['swing', 'coin', 'levelUp']);
    expect(kept[1].t).toBeCloseTo(videoTime(frames, 60, 0.19));
  });

  it('builds YouTube chapters: 0:00 first, at least 10 s apart, not too near the end', () => {
    const events = [
      { event: 'level', level: 'cave1', now: 40 },
      { event: 'boss', type: 'brute', now: 70 },
      { event: 'faint', now: 75 },
      { event: 'boss', type: 'brute', now: 90 },
      { event: 'bossDefeated', type: 'brute', now: 95 },
      { event: 'level', level: 'cave1', now: 120 },
      { event: 'finished', now: 300 },
      { event: 'level', level: 'village', now: 320 },
    ];
    const beats = storyBeats(events);
    expect(beats.map((b) => b.title)).toEqual(['The Rat Burrow', 'Boss: the Big Rat Brute', 'Whiskerwood is saved!', 'Post-game: training to Lv 7']);
    expect(beats[1].now).toBe(90); // the attempt that won
    const v = beats.map((b) => ({ ...b, v: b.now / 2 }));
    expect(chapterList(v, 'Preview', 165)).toEqual(['0:00 Preview', '0:20 The Rat Burrow', '0:45 Boss: the Big Rat Brute', '2:30 Whiskerwood is saved!']);
    expect(clock(3725)).toBe('1:02:05');
  });
});
