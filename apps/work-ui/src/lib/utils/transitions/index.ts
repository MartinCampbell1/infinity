import type { TransitionConfig } from 'svelte/transition';

export const flyAndScale = (
	node: Element,
	params: { y?: number; duration?: number; start?: number } = {}
): TransitionConfig => {
	const duration = params.duration ?? 160;
	const start = params.start ?? 0;

	return {
		duration,
		css: (t) => {
			const eased = start + (1 - start) * t;
			const y = (1 - t) * (params.y ?? 8);
			const scale = 0.985 + 0.015 * t;
			return `opacity: ${eased}; transform: translateY(${y}px) scale(${scale});`;
		}
	};
};
