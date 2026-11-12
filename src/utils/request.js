import router from '@/router';
import { doLogout, getCookie } from '@/utils/auth';
import axios from 'axios';

let baseURL = '';

/**
 * 校验构建期注入的 baseURL。
 * Windows 上的 bash 会把以斜杠开头的环境变量值当成 POSIX 路径，
 * 把 `/api` 转成 `C:/Program Files/Git/api`，这里直接丢弃这种脏值。
 * @param {string|undefined} value
 * @param {string} fallback
 * @returns {string}
 */
function resolveBaseURL(value, fallback) {
  if (!value) return fallback;
  if (/^https?:\/\//i.test(value) || value.startsWith('/')) return value;
  console.warn('[request] 非法的 baseURL，已回退:', value);
  return fallback;
}

// Web 和 Electron 跑在不同端口避免同时启动时冲突
if (process.env.IS_ELECTRON) {
  if (process.env.NODE_ENV === 'production') {
    baseURL = resolveBaseURL(process.env.VUE_APP_ELECTRON_API_URL, '/api');
  } else {
    baseURL = resolveBaseURL(
      process.env.VUE_APP_ELECTRON_API_URL_DEV,
      'http://127.0.0.1:10754'
    );
  }
} else {
  baseURL = resolveBaseURL(process.env.VUE_APP_NETEASE_API_URL, '/api');
}

const service = axios.create({
  baseURL,
  withCredentials: true,
  timeout: 15000,
});

service.interceptors.request.use(function (config) {
  if (!config.params) config.params = {};
  if (baseURL.length) {
    // 显式指定的 cookie（VIP 音源借用）优先；其余请求统一带上当前登录态。
    // Electron 下 document.cookie 可能残留旧账号，这里用 query 参数强制覆盖浏览器 cookie。
    if (config.params.cookie === undefined) {
      const musicU = getCookie('MUSIC_U');
      if (musicU) {
        config.params.cookie = `MUSIC_U=${musicU};`;
      }
    }
  } else {
    console.error("You must set up the baseURL in the service's config");
  }

  if (!process.env.IS_ELECTRON && !config.url.includes('/login')) {
    config.params.realIP = '211.161.244.70';
  }

  // Force real_ip
  const enableRealIP = JSON.parse(
    localStorage.getItem('settings')
  ).enableRealIP;
  const realIP = JSON.parse(localStorage.getItem('settings')).realIP;
  if (process.env.VUE_APP_REAL_IP) {
    config.params.realIP = process.env.VUE_APP_REAL_IP;
  } else if (enableRealIP) {
    config.params.realIP = realIP;
  }

  const proxy = JSON.parse(localStorage.getItem('settings')).proxyConfig;
  if (['HTTP', 'HTTPS'].includes(proxy.protocol)) {
    config.params.proxy = `${proxy.protocol}://${proxy.server}:${proxy.port}`;
  }

  return config;
});

service.interceptors.response.use(
  response => {
    const res = response.data;
    return res;
  },
  async error => {
    if (error && error.message) {
      console.error(
        '[request] failed:',
        (error.config?.baseURL ?? baseURL) + (error.config?.url ?? ''),
        error.message
      );
    }

    /** @type {import('axios').AxiosResponse | null} */
    let response;
    let data;
    if (error === 'TypeError: baseURL is undefined') {
      response = error;
      data = error;
      console.error("You must set up the baseURL in the service's config");
    } else if (error.response) {
      response = error.response;
      data = response.data;
    }

    if (
      response &&
      typeof data === 'object' &&
      data.code === 301 &&
      data.msg === '需要登录'
    ) {
      console.warn('Token has expired. Logout now!');

      // 登出帳戶
      doLogout();

      // 導向登入頁面
      if (process.env.IS_ELECTRON === true) {
        router.push({ name: 'loginAccount' });
      } else {
        router.push({ name: 'login' });
      }
    }
  }
);

export default service;
