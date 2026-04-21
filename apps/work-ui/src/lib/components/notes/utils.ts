import DOMPurify from 'dompurify';
import { toast } from 'svelte-sonner';

import { createNewNote } from '$lib/apis/notes';

export type NoteContent = {
	json: any;
	html: string;
	md: string;
};

export type NoteAccessGrant = {
	principal_type?: string | null;
	principal_id?: string | null;
	permission?: string | null;
	[key: string]: unknown;
};

export type NoteFile = {
	id?: string | null;
	itemId?: string | null;
	type?: string;
	url?: string;
	name?: string;
	status?: string;
	size?: number;
	error?: string;
	content_type?: string | null;
	collection_name?: string | null;
	file?:
		| {
				data?: {
					content?: string | null;
				} | null;
		  }
		| string
		| null;
	[key: string]: unknown;
};

export type NoteRecord = {
	id: string;
	title: string;
	data: {
		content: NoteContent;
		files?: NoteFile[] | null;
		versions?: NoteContent[] | null;
	};
	meta?: Record<string, unknown> | null;
	access_grants: NoteAccessGrant[];
	write_access?: boolean;
	user_id?: string | null;
	created_at: number;
	updated_at?: number | null;
};

export type NoteItem = {
	title: string;
	data: {
		content: NoteContent;
		files?: NoteFile[] | null;
		versions?: NoteContent[] | null;
	};
	meta?: Record<string, unknown> | null;
	access_grants?: NoteAccessGrant[];
};

export type NoteSelection = {
	text: string;
	from: number;
	to: number;
};

export type NoteMessage = {
	role: string;
	content: string;
	done?: boolean;
};

export const downloadPdf = async (note: Pick<NoteRecord, 'title' | 'data'>) => {
	const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
		import('jspdf'),
		import('html2canvas-pro')
	]);

	// Define a fixed virtual screen size
	const virtualWidth = 1024; // Fixed width (adjust as needed)
	const virtualHeight = 1400; // Fixed height (adjust as needed)

	// STEP 1. Get a DOM node to render
	const html = DOMPurify.sanitize(note.data?.content?.html ?? '');
	const isDarkMode = document.documentElement.classList.contains('dark');
	const renderWidth = 800; // px, fixed width for cloned element
	const node = document.createElement('div');

	const titleNode = document.createElement('div');
	titleNode.textContent = note.title;
	titleNode.style.fontSize = '24px';
	titleNode.style.fontWeight = 'medium';
	titleNode.style.paddingBottom = '20px';
	titleNode.style.color = isDarkMode ? 'white' : 'black';
	node.appendChild(titleNode);

	const contentNode = document.createElement('div');
	contentNode.innerHTML = html;
	node.appendChild(contentNode);

	node.classList.add('text-black');
	node.classList.add('dark:text-white');
	node.style.width = `${renderWidth}px`;
	node.style.position = 'absolute';
	node.style.left = '-9999px';
	node.style.height = 'auto';
	node.style.padding = '40px 40px';
	document.body.appendChild(node);

	// Render to canvas with predefined width
	const canvas = await html2canvas(node, {
		useCORS: true,
		backgroundColor: isDarkMode ? '#000' : '#fff',
		scale: 2, // Keep at 1x to avoid unexpected enlargements
		width: virtualWidth, // Set fixed virtual screen width
		windowWidth: virtualWidth, // Ensure consistent rendering
		windowHeight: virtualHeight
	});

	document.body.removeChild(node);

	const imgData = canvas.toDataURL('image/jpeg', 0.7);

	// A4 page settings
	const pdf = new jsPDF('p', 'mm', 'a4');
	const imgWidth = 210; // A4 width in mm
	const pageWidthMM = 210; // A4 width in mm
	const pageHeight = 297; // A4 height in mm
	const pageHeightMM = 297; // A4 height in mm

	if (isDarkMode) {
		pdf.setFillColor(0, 0, 0);
		pdf.rect(0, 0, pageWidthMM, pageHeightMM, 'F'); // black bg
	}

	// Maintain aspect ratio
	const imgHeight = (canvas.height * imgWidth) / canvas.width;
	let heightLeft = imgHeight;
	let position = 0;

	pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
	heightLeft -= pageHeight;

	// Handle additional pages
	while (heightLeft > 0) {
		position -= pageHeight;
		pdf.addPage();

		if (isDarkMode) {
			pdf.setFillColor(0, 0, 0);
			pdf.rect(0, 0, pageWidthMM, pageHeightMM, 'F'); // black bg
		}

		pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
		heightLeft -= pageHeight;
	}

	pdf.save(`${note.title}.pdf`);
};

export const createNoteHandler = async (
	title: string,
	md?: string,
	html?: string
): Promise<NoteRecord | null> => {
	//  $i18n.t('New Note'),
	const res = await createNewNote(localStorage.token, {
		// YYYY-MM-DD
		title: title,
		data: {
			content: {
				json: null,
				html: html || md || '',
				md: md || ''
			}
		},
		meta: null,
		access_grants: []
	}).catch((error) => {
		toast.error(`${error}`);
		return null;
	});

	if (res) {
		return res as NoteRecord;
	}
	return null;
};
