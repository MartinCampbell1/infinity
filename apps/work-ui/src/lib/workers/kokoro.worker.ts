import { env } from '@huggingface/transformers';
import { KokoroTTS } from 'kokoro-js';

// TODO: Below doesn't work as expected, need to investigate further
if (env.backends.onnx.wasm) {
	env.backends.onnx.wasm.wasmPaths = '/wasm/';
}

type KokoroLoadOptions = NonNullable<Parameters<typeof KokoroTTS.from_pretrained>[1]>;
type KokoroGenerateOptions = NonNullable<Parameters<KokoroTTS['generate']>[1]>;
type KokoroDtype = KokoroLoadOptions['dtype'];
type KokoroVoice = KokoroGenerateOptions['voice'];

type KokoroInitMessage = {
	type: 'init';
	payload?: {
		model_id?: string;
		dtype?: KokoroDtype;
	};
};

type KokoroGenerateMessage = {
	type: 'generate';
	payload?: {
		text?: string;
		voice?: KokoroVoice;
	};
};

type KokoroStatusMessage = {
	type: 'status';
	payload?: undefined;
};

type KokoroWorkerMessage = KokoroInitMessage | KokoroGenerateMessage | KokoroStatusMessage;

const getErrorMessage = (error: unknown) =>
	error instanceof Error ? error.message : String(error);

let tts: KokoroTTS | null = null;
let isInitialized = false; // Flag to track initialization status
const DEFAULT_MODEL_ID = 'onnx-community/Kokoro-82M-v1.0-ONNX'; // Default model

self.onmessage = async (event: MessageEvent<KokoroWorkerMessage>) => {
	const { type, payload } = event.data;

	if (type === 'init') {
		let { model_id, dtype } = payload ?? {};
		model_id = model_id || DEFAULT_MODEL_ID; // Use default model if none provided

		self.postMessage({ status: 'init:start' });

		try {
			const supportsWebGpu = typeof navigator !== 'undefined' && 'gpu' in navigator;
			tts = await KokoroTTS.from_pretrained(model_id, {
				dtype,
				device: supportsWebGpu ? 'webgpu' : 'wasm' // Detect WebGPU
			});
			isInitialized = true; // Mark as initialized after successful loading
			self.postMessage({ status: 'init:complete' });
		} catch (error) {
			isInitialized = false; // Ensure it's marked as false on failure
			self.postMessage({ status: 'init:error', error: getErrorMessage(error) });
		}
	}

	if (type === 'generate') {
		if (!isInitialized || !tts) {
			// Ensure model is initialized
			self.postMessage({ status: 'generate:error', error: 'TTS model not initialized' });
			return;
		}

		const { text = '', voice } = payload ?? {};
		self.postMessage({ status: 'generate:start' });

		try {
			const rawAudio = await tts.generate(text, { voice });
			const blob = await rawAudio.toBlob();
			const blobUrl = URL.createObjectURL(blob);
			self.postMessage({ status: 'generate:complete', audioUrl: blobUrl });
		} catch (error) {
			self.postMessage({ status: 'generate:error', error: getErrorMessage(error) });
		}
	}

	if (type === 'status') {
		// Respond with the current initialization status
		self.postMessage({ status: 'status:check', initialized: isInitialized });
	}
};
