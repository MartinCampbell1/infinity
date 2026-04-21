type AutoRefreshOptions = {
	intervalMs?: number;
	immediate?: boolean;
	enabled?: () => boolean;
	onError?: (error: unknown) => void;
};

export const createAutoRefreshLoop = (
	task: () => Promise<void> | void,
	options: AutoRefreshOptions = {}
) => {
	const intervalMs = options.intervalMs ?? 8000;
	const immediate = options.immediate ?? true;
	let intervalId: ReturnType<typeof setInterval> | null = null;
	let inFlight = false;
	let queued = false;

	const runTask = async () => {
		if (inFlight) {
			queued = true;
			return;
		}

		inFlight = true;
		try {
			await task();
		} catch (error) {
			options.onError?.(error);
		} finally {
			inFlight = false;
			if (queued) {
				queued = false;
				void runTask();
			}
		}
	};

	const stop = () => {
		if (intervalId) {
			clearInterval(intervalId);
			intervalId = null;
		}
	};

	const start = () => {
		if (intervalId) {
			return stop;
		}

		intervalId = setInterval(() => {
			if (options.enabled && !options.enabled()) {
				return;
			}

			void runTask();
		}, intervalMs);

		if (immediate) {
			void runTask();
		}

		return stop;
	};

	return {
		refresh: runTask,
		start,
		stop
	};
};
