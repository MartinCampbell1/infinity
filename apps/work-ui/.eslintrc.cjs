module.exports = {
	root: true,
	env: {
		browser: true,
		es2022: true,
		node: true
	},
	ignorePatterns: ['.svelte-kit/**', '.turbo/**', 'build/**', 'node_modules/**'],
	parserOptions: {
		ecmaVersion: 'latest',
		sourceType: 'module'
	},
	plugins: ['@typescript-eslint'],
	overrides: [
		{
			files: ['*.js', '*.ts'],
			parser: '@typescript-eslint/parser'
		},
		{
			files: ['*.svelte'],
			parser: 'svelte-eslint-parser',
			parserOptions: {
				parser: '@typescript-eslint/parser',
				extraFileExtensions: ['.svelte']
			}
		}
	]
};
