const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export function relativeTime(timestamp: number) {
  const diff = Date.now() - timestamp;
  if (diff < MINUTE) return '刚刚';
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)} 分钟前`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)} 小时前`;
  if (diff < 30 * DAY) return `${Math.floor(diff / DAY)} 天前`;
  return fullDate(timestamp);
}

export function fullDate(timestamp: number) {
  const date = new Date(timestamp);
  return `${date.getFullYear()} 年 ${date.getMonth() + 1} 月 ${date.getDate()} 日`;
}

export function firstLine(value: string, max = 80) {
  const line = value.trim().split('\n')[0];
  return line.length > max ? `${line.slice(0, max)}…` : line;
}

export const PRIORITIES = [
  { value: 0, label: '无优先级' },
  { value: 4, label: '紧急' },
  { value: 3, label: '高' },
  { value: 2, label: '中' },
  { value: 1, label: '低' },
];

export const CATEGORY_LABELS = {
  backlog: '待办',
  active: '进行中',
  done: '已完成',
  canceled: '已取消',
} as const;
