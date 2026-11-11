export function getSendSettingsPlugin() {
  const electron = window.require('electron');
  const ipcRenderer = electron.ipcRenderer;
  return store => {
    store.subscribe((mutation, state) => {
      // console.log(mutation);
      if (mutation.type !== 'updateSettings') return;

      const settings = state.settings;
      // VIP 令牌只保留在渲染进程，不落盘到 electron-store：
      // 主进程会把 settings 整体写进 userData/config.json，那是明文文件。
      const payload = settings.vipBorrow
        ? {
            ...settings,
            vipBorrow: {
              enabled: settings.vipBorrow.enabled,
              nickname: settings.vipBorrow.nickname,
              vipType: settings.vipBorrow.vipType,
            },
          }
        : settings;

      ipcRenderer.send('settings', payload);
    });
  };
}
