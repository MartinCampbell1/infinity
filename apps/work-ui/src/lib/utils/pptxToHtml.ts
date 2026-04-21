export const pptxToImages = async (arrayBuffer: ArrayBuffer) => {
	const blob = new Blob([arrayBuffer], { type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' });
	const url = URL.createObjectURL(blob);

	return {
		images: [url],
		html: `<div class="pptx-preview"><img src="${url}" alt="Presentation preview" /></div>`
	};
};

