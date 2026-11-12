import initLocalStorage from './initLocalStorage';
import pkg from '../../package.json';
import updateApp from '@/utils/updateApp';

if (localStorage.getItem('appVersion') === null) {
  localStorage.setItem('settings', JSON.stringify(initLocalStorage.settings));
  localStorage.setItem('data', JSON.stringify(initLocalStorage.data));
  localStorage.setItem('appVersion', pkg.version);
}

updateApp();

export default {
  showLyrics: false,
  enableScrolling: true,
  title: 'YesPlayMusic',
  liked: {
    songs: [],
    songsWithDetails: [], // 只有前12首
    playlists: [],
    albums: [],
    artists: [],
    mvs: [],
    cloudDisk: [],
    playHistory: {
      weekData: [],
      allData: [],
    },
  },
  contextMenu: {
    clickObjectID: 0,
    showMenu: false,
  },
  toast: {
    show: false,
    text: '',
    timer: null,
  },
  modals: {
    addTrackToPlaylistModal: {
      show: false,
      selectedTrackID: 0,
    },
    newPlaylistModal: {
      show: false,
      afterCreateAddTrackID: 0,
    },
  },
  dailyTracks: [],
  lastfm: JSON.parse(localStorage.getItem('lastfm')) || {},
  // 当前播放音源是否来自 VIP 借用，仅内存态，不持久化
  vipSource: {
    active: false,
    br: 0,
  },
  player: JSON.parse(localStorage.getItem('player')),
  settings: JSON.parse(localStorage.getItem('settings')),
  data: JSON.parse(localStorage.getItem('data')),
};
