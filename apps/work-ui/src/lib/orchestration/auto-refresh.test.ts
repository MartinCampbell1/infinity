import { describe, expect, test, vi } from 'vitest';

import { createAutoRefreshLoop } from './auto-refresh';

describe('auto refresh loop', () => {
	test('runs immediately, serializes overlapping ticks, and stops cleanly', async () => {
		vi.useFakeTimers();

		const resolvers: Array<() => void> = [];
		const task = vi.fn(
			() =>
				new Promise<void>((resolve) => {
					resolvers.push(resolve);
				})
		);
		const flushMicrotasks = async () => {
			await Promise.resolve();
			await Promise.resolve();
		};

		const loop = createAutoRefreshLoop(task, { intervalMs: 1000 });
		const stop = loop.start();

		expect(task).toHaveBeenCalledTimes(1);

		await vi.advanceTimersByTimeAsync(1000);
		expect(task).toHaveBeenCalledTimes(1);

		resolvers.shift()?.();
		await flushMicrotasks();

		expect(task).toHaveBeenCalledTimes(2);

		resolvers.shift()?.();
		stop();
		await vi.advanceTimersByTimeAsync(2000);
		expect(task).toHaveBeenCalledTimes(2);

		vi.useRealTimers();
	});
});
