import yaml from 'yaml';
import * as diff from 'diff';
import set from 'lodash.set';
import unset from 'lodash.unset';
import toPath from 'lodash.topath';
import invariant from 'invariant';

export type YamlModificationPath = Parameters<typeof set>[1];

export type YamlModificationSet = {
	type: 'set';
	path: YamlModificationPath;
	value: unknown;
};

export type YamlModificationUnset = {
	type: 'unset';
	path: YamlModificationPath;
};

export type YamlModification =
	| YamlModificationSet
	| YamlModificationUnset;
function isArrayIndexPathSegment(segment: string): boolean {
	return /^\d+$/.test(segment);
}

export function yamlPatch(
	originalYamlString: string,
	modifications: YamlModification[],
): string {
	let originalObject = yaml.parse(originalYamlString);

	for (const modification of modifications) {
		if (modification.type === 'set') {
			originalObject = set(originalObject, modification.path, modification.value);
		} else if (modification.type === 'unset') {
			unset(originalObject, modification.path);
		}
	}

	const newYamlString = yaml.stringify(originalObject);

	const structuredPatch = diff.structuredPatch('', '', originalYamlString, newYamlString, undefined, undefined, {
		context: 0,
	});

	const modificationSignatures = new Set(modifications.map(modification => {
		const modificationPath = toPath(modification.path);
		const modificationPathLastSegment = modificationPath.at(-1);

		invariant(typeof modificationPathLastSegment === 'string', 'Modification path must not be empty');

		const indentation = '  '.repeat(modificationPath.length - 1);

		if (modification.type === 'set') {
			if (isArrayIndexPathSegment(modificationPathLastSegment)) {
				return `+${indentation}- `;
			}

			return '+' + indentation + modificationPathLastSegment + ':';
		}

		if (modification.type === 'unset') {
			if (isArrayIndexPathSegment(modificationPathLastSegment)) {
				return `-${indentation}- `;
			}

			return '-' + indentation + modificationPathLastSegment + ':';
		}

		invariant(false, `Unknown modification type: ${String((modification as any).type)}`);
	}));

	// Console.dir({
	// 	modificationSignatures,
	// }, { depth: null });

	const relevantHunks = structuredPatch.hunks.filter(hunk => {
		const hunkSignatures = hunk.lines.map(line => (
			line
				.replace(/^([+-]\s*\w*):.*$/, '$1:')
				.replace(/^([+-]\s*-) .+$/, '$1 ')
		));

		// Console.dir({
		// 	hunkSignatures,
		// }, { depth: null });

		return hunkSignatures.some(hunkSignature => modificationSignatures.has(hunkSignature));
	});

	// Console.dir({
	// 	hunks: structuredPatch.hunks,
	// 	relevantHunks,
	// }, { depth: null });

	if (relevantHunks.length === 0) {
		return originalYamlString;
	}

	const relevantStructuredPatch = {
		...structuredPatch,
		hunks: relevantHunks,
	};

	const modifiedYamlString = diff.applyPatch(originalYamlString, relevantStructuredPatch);

	if (modifiedYamlString === false) {
		throw new Error('Failed to apply patch');
	}

	return modifiedYamlString;
}
