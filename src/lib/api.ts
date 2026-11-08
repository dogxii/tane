export class ApiFailure extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(method: string, path: string, payload?: unknown, headers: Record<string, string> = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      method,
      cache: 'no-store',
      headers: { ...(payload !== undefined ? { 'content-type': 'application/json' } : {}), ...headers },
      body: payload !== undefined ? JSON.stringify(payload) : undefined,
    });
  } catch {
    throw new ApiFailure(0, 'network', '网络连接失败');
  }
  if (response.status === 304) return null as T;
  const data = (await response.json().catch(() => null)) as any;
  if (!response.ok) {
    throw new ApiFailure(response.status, data?.error?.code ?? 'unknown', data?.error?.message ?? '请求失败');
  }
  return data as T;
}

let early: { path: string; response: Promise<unknown> } | null = null;

/** Starts a page's first request while its code is still downloading. */
export function prefetch(path: string) {
  const response = request('GET', path);
  response.catch(() => {});
  early = { path, response };
}

export function takePrefetch<T>(path: string) {
  if (early?.path !== path) return undefined;
  const { response } = early;
  early = null;
  return response as Promise<T>;
}

export const api = {
  get: <T>(path: string, headers?: Record<string, string>) => request<T>('GET', path, undefined, headers),
  post: <T>(path: string, payload: unknown = {}) => request<T>('POST', path, payload),
  patch: <T>(path: string, payload: unknown) => request<T>('PATCH', path, payload),
  del: <T>(path: string, payload?: unknown) => request<T>('DELETE', path, payload),
};
