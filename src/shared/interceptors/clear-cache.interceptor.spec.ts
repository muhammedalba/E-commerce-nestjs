import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { lastValueFrom, of } from 'rxjs';
import { ClearCacheInterceptor } from './clear-cache.interceptor';

describe('ClearCacheInterceptor', () => {
  const run = async (resources: string[]) => {
    const calls: string[] = [];
    const clearResources = jest.fn(() => {
      calls.push('clear');
      return Promise.resolve();
    });
    const revalidate = jest.fn(() => {
      calls.push('revalidate');
      return Promise.resolve();
    });
    const interceptor = new ClearCacheInterceptor(
      { clearResources } as never,
      { revalidate } as never,
      { get: () => resources } as unknown as Reflector,
    );
    const result = await lastValueFrom(
      interceptor.intercept(
        { getHandler: () => ({}) } as unknown as ExecutionContext,
        { handle: () => of('body') },
      ),
    );
    return { result, calls, clearResources, revalidate };
  };

  it('clears the backend first, then expires the storefront tags', async () => {
    const { result, calls, revalidate } = await run(['categories']);
    expect(result).toBe('body');
    expect(calls).toEqual(['clear', 'revalidate']);
    expect(revalidate).toHaveBeenCalledWith(['categories', 'products']);
  });

  it('does not revalidate resources handled elsewhere or not on the storefront', async () => {
    for (const resources of [['products'], ['order'], ['settings']]) {
      const { revalidate, clearResources } = await run(resources);
      expect(clearResources).toHaveBeenCalledWith(resources);
      expect(revalidate).not.toHaveBeenCalled();
    }
  });
});
