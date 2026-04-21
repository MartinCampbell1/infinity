import { describe, expect, test } from 'vitest';

import { mergeEnabledTerminalServerData } from './terminal-servers';

describe('mergeEnabledTerminalServerData', () => {
	test('preserves original terminal keys when failed servers are filtered out', () => {
		const enabled = [
			{ url: 'http://one.local', key: 'key-one' },
			{ url: 'http://two.local', key: 'key-two' },
			{ url: 'http://three.local', key: 'key-three' }
		];
		const data = [
			{ url: 'http://one.local', title: 'One' },
			{ url: 'http://two.local', error: 'offline' },
			{ url: 'http://three.local', title: 'Three' }
		];

		expect(mergeEnabledTerminalServerData(enabled, data)).toEqual([
			{ url: 'http://one.local', title: 'One', key: 'key-one' },
			{ url: 'http://three.local', title: 'Three', key: 'key-three' }
		]);
	});
});
