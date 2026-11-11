<template>
  <Modal
    :show="show"
    :close="handleClose"
    title="扫码添加 VIP 账号"
    :show-footer="false"
    width="360px"
  >
    <div class="vip-qr">
      <div class="qr-box">
        <img v-if="qrImage" :src="qrImage" alt="登录二维码" />
        <div v-else class="qr-placeholder">二维码生成中…</div>
      </div>
      <p class="status">{{ statusText }}</p>
      <p class="notice">
        请使用<strong>朋友的</strong>网易云 App 扫码，别扫成自己的账号。
        <br />扫码会在对方账号的登录设备列表里新增一条记录。
      </p>
    </div>
  </Modal>
</template>

<script>
import Modal from '@/components/Modal.vue';
import request from '@/utils/request';
import { normalizeVipCookie } from '@/utils/vipBorrow';
import {
  loginQrCodeKey,
  loginQrCodeCreate,
  loginQrCodeCheck,
} from '@/api/auth';

// 显式传空 cookie：让服务端整体覆盖浏览器登录态，避免把主账号身份带进扫码流程
const ANONYMOUS = { cookie: '' };

export default {
  name: 'ModalVipQrCode',
  components: { Modal },
  props: {
    show: Boolean,
    close: {
      type: Function,
      default: () => {},
    },
  },
  data() {
    return {
      qrKey: '',
      qrImage: '',
      statusText: '正在生成二维码…',
      pollTimer: null,
      checking: false,
    };
  },
  watch: {
    show(value) {
      if (value) this.start();
      else this.stop();
    },
  },
  beforeDestroy() {
    this.stop();
  },
  methods: {
    handleClose() {
      this.stop();
      this.close();
    },
    stop() {
      if (this.pollTimer) {
        clearInterval(this.pollTimer);
        this.pollTimer = null;
      }
      this.qrKey = '';
      this.checking = false;
    },
    async start() {
      this.stop();
      this.qrImage = '';
      this.statusText = '正在生成二维码…';
      try {
        const keyResult = await loginQrCodeKey(ANONYMOUS);
        this.qrKey = keyResult?.data?.unikey || '';
        if (!this.qrKey) throw new Error('empty qr key');

        const createResult = await loginQrCodeCreate({
          key: this.qrKey,
          qrimg: true,
          ...ANONYMOUS,
        });
        this.qrImage = createResult?.data?.qrimg || '';
        if (!this.qrImage) throw new Error('empty qr image');

        this.statusText = '请用朋友的网易云 App 扫码';
        this.pollTimer = setInterval(this.checkOnce, 1500);
      } catch (error) {
        console.warn('[vipBorrow] 生成二维码失败', error);
        this.statusText = '二维码生成失败，请检查网络或 API 地址';
      }
    },
    async checkOnce() {
      if (!this.qrKey || this.checking) return;
      this.checking = true;
      try {
        const result = await loginQrCodeCheck(this.qrKey, ANONYMOUS);
        const code = result?.code;
        if (code === 800) {
          this.statusText = '二维码已过期，正在刷新…';
          this.start();
        } else if (code === 802) {
          this.statusText = '已扫码，请在手机上确认';
        } else if (code === 803) {
          this.stop();
          this.statusText = '登录成功，正在校验账号…';
          await this.finish(result.cookie);
        }
      } catch (error) {
        // 单次轮询失败不打断整体流程
      } finally {
        this.checking = false;
      }
    },
    async finish(rawCookie) {
      const cookie = normalizeVipCookie(
        String(rawCookie || '').replaceAll(' HTTPOnly', '')
      );
      if (!cookie) {
        this.statusText = '未能获取登录信息，请重试';
        return;
      }

      try {
        const status = await request({
          url: '/login/status',
          method: 'get',
          params: { cookie, timestamp: new Date().getTime() },
        });
        const profile = status?.data?.profile;
        this.statusText = profile
          ? `已绑定：${profile.nickname}`
          : '已绑定，但未能读取账号信息';
        this.$emit('success', {
          cookie,
          nickname: profile?.nickname || '',
          vipType: profile?.vipType ?? 0,
        });
      } catch (error) {
        console.warn('[vipBorrow] 校验账号失败', error);
        this.statusText = '已扫码，但校验账号信息失败';
        this.$emit('success', { cookie, nickname: '', vipType: 0 });
      }
    },
  },
};
</script>

<style lang="scss" scoped>
.vip-qr {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px 0 4px;

  .qr-box {
    width: 200px;
    height: 200px;
    background: #ffffff;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;

    img {
      width: 100%;
      height: 100%;
      object-fit: contain;
    }
  }

  .qr-placeholder {
    font-size: 13px;
    color: #888888;
  }

  .status {
    margin-top: 12px;
    font-size: 13px;
    color: var(--color-text);
    text-align: center;
  }

  .notice {
    margin-top: 8px;
    font-size: 12px;
    line-height: 1.6;
    color: var(--color-text);
    opacity: 0.68;
    text-align: center;
  }
}
</style>
