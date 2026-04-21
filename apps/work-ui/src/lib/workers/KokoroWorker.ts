export type KokoroWorkerOptions = {
	dtype?: string;
};

export type KokoroGenerateParams = {
	text: string;
	voice?: string;
};

export class KokoroWorker {
	private readonly dtype: string;

	constructor(options: KokoroWorkerOptions = {}) {
		this.dtype = options.dtype ?? 'fp32';
	}

	async init() {
		return this;
	}

	async generate(params: KokoroGenerateParams) {
		const payload = JSON.stringify({
			dtype: this.dtype,
			voice: params.voice ?? null,
			text: params.text
		});

		const blob = new Blob([payload], { type: 'application/octet-stream' });
		return URL.createObjectURL(blob);
	}
}

