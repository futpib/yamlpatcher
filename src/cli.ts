#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises';
import process from 'node:process';
import {
	command, string, positional, restPositionals, binary, run,
} from 'cmd-ts';
import yaml from 'yaml';
import { yamlPatch, type YamlModification } from './index.js';

function parseModification(modificationString: string): YamlModification {
	const [ setLeftString, setRightString ] = modificationString.split('=').map(s => s.trim());

	if (modificationString.startsWith('delete ')) {
		const path = modificationString.slice('delete '.length).trim();
		return {
			type: 'unset',
			path,
		};
	}

	if (
		typeof setLeftString === 'string'
		&& typeof setRightString === 'string'
	) {
		const value = yaml.parse(setRightString);

		return {
			type: 'set',
			path: setLeftString,
			value,
		};
	}

	throw new Error(`Invalid modification statement: ${modificationString}`);
}

const app = command({
	name: 'yamlpatcher',
	description: 'Patch YAML files with modifications',
	version: '1.0.0',
	args: {
		file: positional({
			type: string,
			displayName: 'file',
			description: 'YAML file to patch',
		}),
		modifications: restPositionals({
			type: string,
			displayName: 'modifications',
			description: 'Modifications to apply (e.g., "a.b.c=value" or "delete a.b.c")',
		}),
	},
	async handler({ file, modifications }) {
		const originalYamlString = await readFile(file, 'utf8');

		const parsedModifications = modifications.map(modificationString => parseModification(modificationString));

		const newYamlString = yamlPatch(originalYamlString, parsedModifications);

		await writeFile(file, newYamlString, 'utf8');
	},
});

void run(binary(app), process.argv);
