// 共享的离线判断阈值管理工具

const STORAGE_KEY = 'offline_threshold_minutes';

/**
 * 获取离线判断阈值（单位：分钟）
 * 默认值为1分钟
 */
export const getOfflineThreshold = (): number => {
  if (typeof window === 'undefined') return 1;
  const saved = localStorage.getItem(STORAGE_KEY);
  return saved ? parseFloat(saved) : 1;
};

/**
 * 设置离线判断阈值（单位：分钟）
 */
export const setOfflineThreshold = (minutes: number): void => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, minutes.toString());
};

/**
 * 判断是否在线：最后心跳时间与现在时间差大于阈值认为离线
 * @param lastHeartbeat 最后心跳时间（Unix时间戳，秒）
 * @param thresholdMinutes 阈值（分钟），如果不提供则从localStorage读取
 */
export const isOnline = (lastHeartbeat?: number, thresholdMinutes?: number): boolean => {
  if (!lastHeartbeat) return false;
  const threshold = thresholdMinutes !== undefined ? thresholdMinutes : getOfflineThreshold();
  const now = Math.floor(Date.now() / 1000);
  const diff = now - lastHeartbeat;
  const thresholdSeconds = threshold * 60; // 转换为秒
  return diff <= thresholdSeconds;
};

