import type { Requester } from './client';
import type { CreateProductInput } from './types';
export { categoryFor } from './categories';

export function createProductCall(request: Requester, p: CreateProductInput, requestId: string): Promise<{ id: string }> {
  const body: Record<string, unknown> = { name: p.name.slice(0, 127), type: p.type };
  if (p.description) body.description = p.description.slice(0, 256);
  if (p.category) body.category = p.category;
  return request<{ id: string }>('POST', '/v1/catalogs/products', { body, requestId }).then((r) => ({ id: r.id }));
}
