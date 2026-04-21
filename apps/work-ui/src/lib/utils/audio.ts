type AudioQueueOptions = {
	loop?: boolean;
};

export class AudioQueue {
	private element: HTMLAudioElement | null;
	private queue: string[] = [];
	private playing = false;
	private activeUrl: string | null = null;
	private readonly loop: boolean;
	private readonly handleEnded = () => {
		void this.playNext();
	};

	onStopped: (() => void) | null = null;
	private playbackRate = 1;
	private currentId = '';

	constructor(element: HTMLAudioElement | null, options: AudioQueueOptions = {}) {
		this.element = element;
		this.loop = !!options.loop;

		if (this.element) {
			this.element.addEventListener('ended', this.handleEnded);
		}
	}

	setId(id: string) {
		this.currentId = id;
	}

	setPlaybackRate(rate: number) {
		this.playbackRate = Number.isFinite(rate) && rate > 0 ? rate : 1;
		if (this.element) {
			this.element.playbackRate = this.playbackRate;
		}
	}

	enqueue(url: string) {
		if (!url) {
			return;
		}

		this.queue.push(url);
		void this.playNext();
	}

	stop() {
		this.queue = [];
		this.playing = false;

		if (this.element) {
			this.element.pause();
			this.element.removeAttribute('src');
			this.element.load();
		}

		if (this.activeUrl) {
			URL.revokeObjectURL(this.activeUrl);
			this.activeUrl = null;
		}

		this.onStopped?.();
	}

	destroy() {
		this.stop();
		if (this.element) {
			this.element.removeEventListener('ended', this.handleEnded);
		}
		this.element = null;
	}

	private async playNext() {
		if (this.playing) {
			return;
		}

		const nextUrl = this.queue.shift();
		if (!nextUrl || !this.element) {
			if (!nextUrl) {
				this.onStopped?.();
			}
			return;
		}

		this.playing = true;
		this.activeUrl = nextUrl;
		this.element.playbackRate = this.playbackRate;
		this.element.src = nextUrl;

		try {
			await this.element.play();
		} catch {
			this.playing = false;
			this.onStopped?.();
			return;
		}

		if (!this.loop) {
			this.playing = false;
		}
	}
}

