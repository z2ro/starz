export class ApiError extends Error {
  constructor(message:string, public readonly status:number) { super(message); this.name='ApiError'; }
}

export async function apiRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const options = init?.method && !['GET', 'HEAD'].includes(init.method.toUpperCase()) ? { ...init, headers: { ...(init.body ? {'content-type':'application/json'} : {}), ...init.headers, 'x-starz-request': '1' } } : init;
  const response = await fetch(url, options);
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiError(typeof result.detail === 'string' ? result.detail : 'Não foi possível concluir a operação.', response.status);
  return result as T;
}
