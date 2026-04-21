type EnabledTerminalConfig = {
	url: string;
	key?: string | null;
};

type ToolServerData = Record<string, unknown> & {
	error?: unknown;
};

export function mergeEnabledTerminalServerData(
	enabledTerminals: EnabledTerminalConfig[],
	terminalServersData: Array<ToolServerData | null | undefined>
) {
	return enabledTerminals.flatMap((terminal, index) => {
		const data = terminalServersData[index];
		if (!data || data.error) {
			return [];
		}

		return [
			{
				...data,
				key: terminal.key ?? ''
			}
		];
	});
}
