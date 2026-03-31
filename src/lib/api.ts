const base = (import.meta.env.VITE_API_BASE as string | undefined) ?? '';

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${base}/api${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  if (!res.ok) {
    let msg = text || res.statusText;
    try {
      const j = JSON.parse(text) as { error?: string; hint?: string };
      if (j?.error) msg = j.error;
      if (j?.hint) msg = `${msg} — ${j.hint}`;
    } catch {
      /* use text (e.g. HTML proxy error) */
    }
    throw new Error(msg);
  }
  return (text ? JSON.parse(text) : undefined) as T;
}
