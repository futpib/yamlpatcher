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
	const [ deleteEmptyString, deleteString ] = modificationString.split(/\s+delete\s+/).map(s => s.trim());

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

	if (
		typeof deleteEmptyString === 'string'
		&& !deleteEmptyString
		&& typeof deleteString === 'string'
	) {
		return {
			type: 'unset',
			path: deleteString,
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
