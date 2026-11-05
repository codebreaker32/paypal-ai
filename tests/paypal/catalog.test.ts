/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { describe, expect, it } from 'vitest';
import { categoryFor } from '@/lib/paypal/categories';
import { PayPalApiError } from '@/lib/paypal/types';
import { fixture, makeClient } from './helpers';

describe('categoryFor', () => {
  it('only food shops get a category', () => {
    expect(categoryFor('food')).toBe('FOOD_RETAIL_AND_SERVICE');
    expect(categoryFor('goods')).toBeUndefined();
    expect(categoryFor('services')).toBeUndefined();
  });
});

describe('createProduct', () => {
  it('omits category when undefined and sends the request id', async () => {
    const { client, calls } = makeClient({ 'POST /v1/catalogs/products': [{ status: 201, body: { id: 'PROD-123' } }] });
    const r = await client.createProduct({ name: 'Croissant', type: 'PHYSICAL', category: undefined }, 'pub-item1');
    expect(r).toEqual({ id: 'PROD-123' });
    const call = calls.find((c) => c.url.endsWith('/catalogs/products'))!;
    expect(call.body).toEqual({ name: 'Croissant', type: 'PHYSICAL' });
    expect('category' in call.body).toBe(false);
    expect(call.headers['PayPal-Request-Id']).toBe('pub-item1');
  });

  it('sends category and truncates name (127) and description (256)', async () => {
    const { client, calls } = makeClient({ 'POST /v1/catalogs/products': [{ status: 201, body: { id: 'PROD-1' } }] });
    await client.createProduct({ name: 'n'.repeat(200), description: 'd'.repeat(400), type: 'SERVICE', category: 'FOOD_RETAIL_AND_SERVICE' }, 'r');
    const body = calls.find((c) => c.url.endsWith('/catalogs/products'))!.body;
    expect(body.name).toHaveLength(127);
    expect(body.description).toHaveLength(256);
    expect(body.category).toBe('FOOD_RETAIL_AND_SERVICE');
  });

  it('surfaces the category 400 with its issue', async () => {
    const { client } = makeClient({ 'POST /v1/catalogs/products': [fixture('category-400')] });
    const err = await client.createProduct({ name: 'x', type: 'PHYSICAL', category: 'BAD' }, 'r').catch((e) => e);
    expect(err).toBeInstanceOf(PayPalApiError);
    expect(err).toMatchObject({ status: 400, errorName: 'INVALID_REQUEST', issue: 'INVALID_PARAMETER_VALUE' });
  });
});
