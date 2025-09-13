import test from 'ava';
import { testProp, fc } from '@fast-check/ava';
import yaml from 'yaml';
import { type YamlModification, yamlPatch } from './index.js';

const fcYamlPathSegment = fc.oneof(
	fc.string({ minLength: 1, maxLength: 10 }),
	fc.integer({ min: 1, max: 10 }),
);

const fcYamlPath = fc.array(fcYamlPathSegment, {
	minLength: 1,
	maxLength: 5,
});

const fcYamlModificationSet = fc.record({
	type: fc.constant('set' as const),
	path: fcYamlPath,
	value: fc.jsonValue(),
});

const fcYamlModificationUnset = fc.record({
	type: fc.constant('unset' as const),
	path: fcYamlPath,
});

const fcYamlModification = fc.oneof(
	fcYamlModificationSet,
	fcYamlModificationUnset,
);

const fcYamlModifications = fc.array(fcYamlModification);

testProp(
	'yamlPatch applies modifications without error',
	[
		fc.jsonValue(),
		fcYamlModifications,
	],
	(t, originalJson, modifications) => {
		const originalYamlString = yaml.stringify(originalJson);
		const newYamlString = yamlPatch(originalYamlString, modifications);
		yaml.parse(newYamlString);
		t.pass();
	},
);

function parseModificationsString(modificationsString: string): YamlModification[] {
	const modifications: YamlModification[] = [];

	const modificationStatementStrings = modificationsString.split(/[;\n]/).map(s => s.trim()).filter(s => s.length > 0);

	for (const modificationStatementString of modificationStatementStrings) {
		const [ setLeftString, setRightString ] = modificationStatementString.split('=').map(s => s.trim());
		const [ deleteEmptyString, deleteString ] = modificationStatementString.split('delete').map(s => s.trim());

		if (
			typeof setLeftString === 'string'
			&& typeof setRightString === 'string'
		) {
			const value = eval(`(${setRightString})`);

			modifications.push({
				type: 'set',
				path: setLeftString,
				value,
			});

			continue;
		}

		if (
			typeof deleteEmptyString === 'string'
			&& !deleteEmptyString
			&& typeof deleteString === 'string'
		) {
			modifications.push({
				type: 'unset',
				path: deleteString,
			});

			continue;
		}

		throw new Error(`Invalid modification statement: ${modificationStatementString}`);
	}

	return modifications;
}

const yamlPatchMacro = test.macro({
	exec(t, originalYamlString: string, modificationsString: string, expectedYamlString: string) {
		const modifications = parseModificationsString(modificationsString);
		const newYamlString = yamlPatch(originalYamlString, modifications);
		t.is(newYamlString.trim(), expectedYamlString.trim());
	},
	title(providedTitle: string | undefined, originalYamlString: string, modificationsString: string, expectedYamlString: string) {
		return providedTitle ?? `yamlPatch simple:\n${originalYamlString}\n${modificationsString}\n${expectedYamlString}`;
	},
});

test.serial.skip(yamlPatchMacro, 'null', '= null', 'null');

test.serial(yamlPatchMacro, 'a: 1', 'a = 2; a = 3', 'a: 3');

test.serial(yamlPatchMacro, `
a:
  b:
    c: 1
`, 'a.b.c = 2; a.b.d = 3', `
a:
  b:
    c: 2
    d: 3
`);

test.serial(yamlPatchMacro, `
# comment 1
a:
# comment 2
  b:
    c: 1
`, 'a.b.c = 2; a.b.d = 3', `
# comment 1
a:
# comment 2
  b:
    c: 2
    d: 3
`);

test.serial(yamlPatchMacro, `
# comment 1
a:
- 0
- 1
`, 'a[0] = 2; a[1] = 3; a[2] = 4', `
# comment 1
a:
  - 2
  - 3
  - 4
`);
