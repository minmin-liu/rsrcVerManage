import COS from 'cos-js-sdk-v5';
import axios from 'axios';
import { API } from '../config/api';

export type CosTmpSecretResponse = {
  errCode: number;
  errMsg: string;
  data?: {
    bucket: string;
    region: string;
    tmpSecretId: string;
    tmpSecretKey: string;
    sessionToken: string;
    startTime?: number; // 秒级时间戳（可选）
    expiredTime?: number; // 秒级时间戳（可选）
  };
};

const DEFAULT_EXPIRE_SECONDS = 60 * 60; // 1小时（你们当前规则）

export const getCosTmpSecretFgn = async () => {
  const resp = await axios.post<CosTmpSecretResponse>(API.COS_TMP_SECRET_FGN, {}, {});
  const { errCode, errMsg, data } = resp.data || ({} as CosTmpSecretResponse);
  if (errCode !== 0 || !data) {
    throw new Error(errMsg || '获取COS临时密钥失败');
  }
  // COS JS SDK 的 getAuthorization 回调要求 ExpiredTime 必填（秒级时间戳）。
  // 你们当前接口示例未返回 startTime/expiredTime，这里按“1小时有效期”兜底补齐。
  const nowSec = Math.floor(Date.now() / 1000);
  const startTime = typeof data.startTime === 'number' && data.startTime > 0 ? data.startTime : nowSec;
  const expiredTime =
    typeof data.expiredTime === 'number' && data.expiredTime > 0
      ? data.expiredTime
      : startTime + DEFAULT_EXPIRE_SECONDS;

  return { ...data, startTime, expiredTime };
};

type CachedSts = {
  sts: NonNullable<CosTmpSecretResponse['data']>;
  expireAtMs: number;
};

const DEFAULT_STS_TTL_MS = 10 * 60 * 1000; // 若服务端未返回 expiredTime，避免短时间内重复拉取

const toCallbackSts = (s: NonNullable<CosTmpSecretResponse['data']>) => ({
  TmpSecretId: s.tmpSecretId,
  TmpSecretKey: s.tmpSecretKey,
  SecurityToken: s.sessionToken,
  // COS SDK 需要秒级时间戳，且 ExpiredTime 必填
  StartTime: s.startTime,
  ExpiredTime: s.expiredTime,
  ScopeLimit: true,
});

const calcExpireAtMs = (s: NonNullable<CosTmpSecretResponse['data']>) => {
  if (typeof s.expiredTime === 'number' && s.expiredTime > 0) {
    // 提前 60s 过期，防止签名刚好临界
    return s.expiredTime * 1000 - 60 * 1000;
  }
  return Date.now() + DEFAULT_STS_TTL_MS;
};

export const createCosClient = (initialSts?: NonNullable<CosTmpSecretResponse['data']>) => {
  let cache: CachedSts | null = initialSts
    ? { sts: initialSts, expireAtMs: calcExpireAtMs(initialSts) }
    : null;

  return new COS({
    getAuthorization: async (_options: any, callback: any) => {
      try {
        if (cache && Date.now() < cache.expireAtMs) {
          callback(toCallbackSts(cache.sts));
          return;
        }

        const s = await getCosTmpSecretFgn();
        cache = { sts: s, expireAtMs: calcExpireAtMs(s) };
        callback(toCallbackSts(s));
      } catch (e: any) {
        callback(e);
      }
    },
  });
};

export const buildPcToolCosKey = (plainFileName: string, version: string) => {
  // 约定：PC 工具版本管理模块 Key 规则为 tools/pc/{时间戳}-{文件名}
  void version; // 保留参数，避免调用处改动；此处不参与 Key 生成
  return `tools/pc/${Date.now()}-${plainFileName}`;
};

