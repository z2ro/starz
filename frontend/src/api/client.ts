export async function apiRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const options = init?.method && !['GET', 'HEAD'].includes(init.method.toUpperCase()) ? { ...init, headers: { ...(init.body ? {'content-type':'application/json'} : {}), ...init.headers, 'x-starz-request': '1' } } : init;
  const response = await fetch(url, options);
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof result.detail === 'string' ? result.detail : 'Não foi possível concluir a operação.');
  return result as T;
}
