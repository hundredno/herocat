// Offline rendering of the game's sounds for video recordings (scripts/record). Lives apart from
// audio.js so it ships in the bot's chunk, not in the game players download.
import { SOUNDS, mixBus, renderSound } from './audio.js';
import { renderMusic } from './music.js';

/**
 * Renders a log of sounds ({ t, name, opts, vol, pan }, t in seconds) into stereo PCM for the
 * time span [from, to). Sounds that started up to `preroll` seconds earlier still ring into it.
 * music: song timeline [{ t, track }] on the same clock. Returns [left, right] Float32Arrays.
 * Used by the video recorder; never by the game itself.
 */
export async function renderOffline(events, from, to, { sampleRate = 48000, preroll = 3, music = [] } = {}) {
  const frames = Math.ceil((to - from) * sampleRate);
  const ctx = new OfflineAudioContext(2, frames + Math.ceil(preroll * sampleRate), sampleRate);
  const { master, noiseBuf } = mixBus(ctx);
  const state = { combo: 0, lastCoin: -1 };
  for (const ev of events) {
    if (ev.t < from - preroll || ev.t >= to || !SOUNDS[ev.name]) continue;
    renderSound(ctx, master, noiseBuf, ev.name, ev.opts ?? {}, ev.vol ?? 1, ev.pan ?? 0, ev.t - from + preroll, state);
  }
  renderMusic(ctx, master, noiseBuf, music, from, to, from - preroll);
  const buf = await ctx.startRendering();
  const skip = buf.length - frames;
  return [0, 1].map((c) => buf.getChannelData(c).slice(skip));
}
