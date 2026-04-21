export const excelToTable = async (sheet: Record<string, unknown>) => {
	const rows = new Map<number, Record<string, string>>();

	for (const [cellRef, value] of Object.entries(sheet ?? {})) {
		if (cellRef.startsWith('!')) {
			continue;
		}

		const match = /^([A-Z]+)(\d+)$/.exec(cellRef);
		if (!match) {
			continue;
		}

		const rowIndex = Number(match[2]);
		const columnKey = match[1];
		const row = rows.get(rowIndex) ?? {};
		row[columnKey] = String(value ?? '');
		rows.set(rowIndex, row);
	}

	const orderedRows = [...rows.entries()]
		.sort(([left], [right]) => left - right)
		.map(([, row]) => row);

	const headers = [...new Set(orderedRows.flatMap((row) => Object.keys(row)))].sort();
	const body = orderedRows
		.map(
			(row) =>
				`<tr>${headers.map((header) => `<td>${escapeHtml(row[header] ?? '')}</td>`).join('')}</tr>`
		)
		.join('');

	return {
		html: `<table><thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join('')}</tr></thead><tbody>${body}</tbody></table>`
	};
};

const escapeHtml = (value: string) =>
	value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#39;');

