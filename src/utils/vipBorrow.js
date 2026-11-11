/**
 * VIP 音源借用
 *
 * 用途：主账号（普通用户）播放 VIP / 无版权歌曲时，临时改用另一个账号的
 * MUSIC_U 去换取播放地址。
 *
 * 隔离边界（改动时务必守住）：
 * 1. 只有 /song/url 会显式带上这里的 cookie，见 api/track.js 的 getMP3；
 * 2. 播放地址拿到后由 CDN 直连播放，不再经过 API 层；
 * 3. 播放上报（scrobble）、歌单、日推、红心等请求一律沿用主账号 cookie。
 *
 * 因此对方的播放记录、听歌排行、每日推荐不会被影响。
 *
 * 本模块不 import 任何业务模块，避免与 store / request 形成循环依赖。
 */

const SETTINGS_KEY = 'settings';

let cachedRaw = null;
let cachedConfig = null;

/**
 * 读取 settings.vipBorrow，按 localStorage 原始字符串做一层缓存。
 * isTrackPlayable 会在歌单渲染时被调用上千次，避免重复 JSON.parse。
 * @returns {{enabled?: boolean, cookie?: string, nickname?: string}|null}
 */
function readVipConfig() {
  let raw = null;
  try {
    raw = localStorage.getItem(SETTINGS_KEY);
  } catch (error) {
    return null;
  }
  if (raw === cachedRaw) return cachedConfig;

  cachedRaw = raw;
  try {
    cachedConfig = JSON.parse(raw || '{}').vipBorrow || null;
  } catch (error) {
    console.warn('[vipBorrow] 解析 settings 失败', error);
    cachedConfig = null;
  }
  return cachedConfig;
}

/**
 * 把用户粘贴的内容归一成 `MUSIC_U=xxx`。
 * 支持三种形式：纯值、`MUSIC_U=xxx`、整段 cookie 串。
 * @param {string} raw
 * @returns {string}
 */
export function normalizeVipCookie(raw) {
  if (!raw) return '';
  const text = String(raw)
    .replace(/[\r\n\t]/g, ' ')
    .trim();
  if (!text) return '';

  const matched = text.match(/MUSIC_U=([^;\s]+)/);
  if (matched) return `MUSIC_U=${matched[1]}`;
  // 写了 MUSIC_U= 但没给值，按未配置处理，别把键名当成值
  if (/MUSIC_U=/.test(text)) return '';

  const value = text.split(';')[0].trim();
  return value ? `MUSIC_U=${value}` : '';
}

/**
 * 是否已开启并配置了 VIP 令牌。
 * @returns {boolean}
 */
export function isVipBorrowEnabled() {
  const config = readVipConfig();
  return !!config && config.enabled === true && !!normalizeVipCookie(config.cookie);
}

/**
 * 取出当前生效的 VIP cookie；未启用或未配置时返回空串。
 * @returns {string}
 */
export function getVipCookie() {
  if (!isVipBorrowEnabled()) return '';
  return normalizeVipCookie(readVipConfig().cookie);
}
