import store from '@/store';
import request from '@/utils/request';
import { mapTrackPlayableStatus } from '@/utils/common';
import {
  cacheTrackDetail,
  getTrackDetailFromCache,
  cacheLyric,
  getLyricFromCache,
} from '@/utils/db';

/**
 * 音质档位，从高到低。数值直接透传给 /song/url 的 br 参数。
 * 999000 = Hi-Res，350000 = 无损（设置里的 flac 档），320000/192000/128000 为有损档。
 */
const QUALITY_LADDER = [999000, 350000, 320000, 192000, 128000];

/**
 * 把设置里的 musicQuality 归一成码率数字。
 * @param {string|number=} quality
 * @returns {number}
 */
export function getMusicQualityBr(quality) {
  const preferred = Number(quality === 'flac' ? 350000 : quality || 320000);
  return Number.isFinite(preferred) && preferred > 0 ? preferred : 320000;
}

/**
 * 生成从用户设定档位向下递减的码率数组。
 * 借用他人账号取址时，先从自己能接受的最高档试起，没有权限再逐级降。
 * @param {string|number=} quality
 * @returns {number[]}
 */
export function getQualityLadder(quality) {
  const preferred = getMusicQualityBr(quality);
  const ladder = QUALITY_LADDER.filter(br => br <= preferred);
  return ladder.length ? ladder : [preferred];
}

/**
 * 获取音乐 url
 * 说明 : 使用歌单详情接口后 , 能得到的音乐的 id, 但不能得到的音乐 url, 调用此接口, 传入的音乐 id( 可多个 , 用逗号隔开 ), 可以获取对应的音乐的 url,
 * !!!未登录状态返回试听片段(返回字段包含被截取的正常歌曲的开始时间和结束时间)
 * @param {string} id - 音乐的 id，例如 id=405998841,33894312
 * @param {Object=} options
 * @param {string=} options.cookie - 显式指定 cookie，用于 VIP 音源借用；不传则沿用当前登录态
 * @param {number=} options.br - 显式指定码率，覆盖设置里的音质档位
 */
export function getMP3(id, options = {}) {
  const getBr = () => {
    if (options.br) return options.br;
    // 当返回的 quality >= 400000时，就会优先返回 hi-res
    return getMusicQualityBr(store.state.settings?.musicQuality);
  };

  return request({
    url: '/song/url',
    method: 'get',
    params: {
      id,
      br: getBr(),
      ...(options.cookie ? { cookie: options.cookie } : {}),
    },
  });
}

/**
 * 获取歌曲详情
 * 说明 : 调用此接口 , 传入音乐 id(支持多个 id, 用 , 隔开), 可获得歌曲详情(注意:歌曲封面现在需要通过专辑内容接口获取)
 * @param {string} ids - 音乐 id, 例如 ids=405998841,33894312
 */
export function getTrackDetail(ids) {
  const fetchLatest = () => {
    return request({
      url: '/song/detail',
      method: 'get',
      params: {
        ids,
      },
    }).then(data => {
      data.songs.map(song => {
        const privileges = data.privileges.find(t => t.id === song.id);
        cacheTrackDetail(song, privileges);
      });
      data.songs = mapTrackPlayableStatus(data.songs, data.privileges);
      return data;
    });
  };
  fetchLatest();

  let idsInArray = [String(ids)];
  if (typeof ids === 'string') {
    idsInArray = ids.split(',');
  }

  return getTrackDetailFromCache(idsInArray).then(result => {
    if (result) {
      result.songs = mapTrackPlayableStatus(result.songs, result.privileges);
    }
    return result ?? fetchLatest();
  });
}

/**
 * 获取歌词
 * 说明 : 调用此接口 , 传入音乐 id 可获得对应音乐的歌词 ( 不需要登录 )
 * @param {number} id - 音乐 id
 */
export function getLyric(id) {
  const fetchLatest = () => {
    return request({
      url: '/lyric',
      method: 'get',
      params: {
        id,
      },
    }).then(result => {
      cacheLyric(id, result);
      return result;
    });
  };

  fetchLatest();

  return getLyricFromCache(id).then(result => {
    return result ?? fetchLatest();
  });
}

/**
 * 获取云盘歌曲内嵌歌词 * 说明 : 调用此接口 , 传入音乐 id 可获得云盘歌曲的内嵌歌词
 * @param {number} songId - 音乐 id
 * @param {number} userId - 用户 id
 */
export function getCloudLyric(songId, userId) {
  const fetchLatest = () => {
    return request({
      url: '/api',
      method: 'get',
      params: {
        uri: `/api/cloud/lyric/get`,
        data: {
          songId,
          userId,
          lv: '-1',
          kv: '-1',
        },
        crypto: 'eapi',
      },
    }).then(result => {
      cacheLyric(songId, result);
      return result;
    });
  };

  fetchLatest();

  return getLyricFromCache(songId).then(result => {
    return result ?? fetchLatest();
  });
}

/**
 * 新歌速递
 * 说明 : 调用此接口 , 可获取新歌速递
 * @param {number} type - 地区类型 id, 对应以下: 全部:0 华语:7 欧美:96 日本:8 韩国:16
 */
export function topSong(type) {
  return request({
    url: '/top/song',
    method: 'get',
    params: {
      type,
    },
  });
}

/**
 * 喜欢音乐
 * 说明 : 调用此接口 , 传入音乐 id, 可喜欢该音乐
 * - id - 歌曲 id
 * - like - 默认为 true 即喜欢 , 若传 false, 则取消喜欢
 * @param {Object} params
 * @param {number} params.id
 * @param {boolean=} [params.like]
 */
export function likeATrack(params) {
  params.timestamp = new Date().getTime();
  return request({
    url: '/like',
    method: 'get',
    params,
  });
}

/**
 * 听歌打卡
 * 说明 : 调用此接口 , 传入音乐 id, 来源 id，歌曲时间 time，更新听歌排行数据
 * - id - 歌曲 id
 * - sourceid - 歌单或专辑 id
 * - time - 歌曲播放时间,单位为秒
 * @param {Object} params
 * @param {number} params.id
 * @param {number} params.sourceid
 * @param {number=} params.time
 */
export function scrobble(params) {
  params.timestamp = new Date().getTime();
  return request({
    url: '/scrobble',
    method: 'get',
    params,
  });
}
