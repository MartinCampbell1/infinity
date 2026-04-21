declare module 'sortablejs' {
	export interface SortableOptions {
		animation?: number;
		handle?: string;
		onUpdate?: () => void;
	}

	export default class Sortable {
		constructor(element: HTMLElement, options?: SortableOptions);
		destroy(): void;
	}
}
