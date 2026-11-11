import clc from 'cli-color';
import checkAuthToken from '../utils/checkAuthToken';
import server from '@neteaseapireborn/api/server';

export async function startNeteaseMusicApi() {
  // Let user know that the service is starting
  console.log(`${clc.redBright('[NetEase API]')} initiating NCM API`);

  // Load the NCM API.
  await server.serveNcmApi({
    port: 10754,
    // 只监听回环地址：默认的 0.0.0.0 会把接口暴露到局域网，并触发 Windows 防火墙弹窗
    host: '127.0.0.1',
    moduleDefs: require('../ncmModDef'),
  });
}
