import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import {
	isRecord,
	normalizeRepositoryRoot,
	type ReadError,
	type ReadResult,
	type RegisteredProject,
	type WorklistItem,
	type WorklistSnapshot,
	type WorklistStatus,
} from "../types";

interface StateFolder {
	name: WorklistSnapshot["stateFolder"];
	path: string;
}

function failure(kind: ReadError["kind"], message: string): ReadResult<never> {
	return { ok: false, error: { kind, message } };
}

function errorCode(cause: unknown): string | undefined {
	if (typeof cause === "object" && cause !== null && "code" in cause) {
		const code = (cause as { code?: unknown }).code;
		return typeof code === "string" ? code : undefined;
	}
	return undefined;
}

function causeMessage(cause: unknown): string {
	return cause instanceof Error && cause.message ? cause.message : "Unknown filesystem error.";
}

function nonEmptyString(value: unknown): value is string {
	return typeof value === "string" && value.trim().length > 0;
}

async function findStateFolder(repositoryRoot: string): Promise<ReadResult<StateFolder>> {
	const currentPath = join(repositoryRoot, ".bram");
	try {
		const currentStat = await stat(currentPath);
		if (!currentStat.isDirectory()) {
			return failure("invalid", `The Bram state path is not a directory: ${currentPath}`);
		}
		return { ok: true, value: { name: ".bram", path: currentPath } };
	} catch (cause) {
		if (errorCode(cause) !== "ENOENT") {
			return failure("unavailable", `Could not inspect the Bram state path: ${causeMessage(cause)}`);
		}
	}

	const legacyPath = join(repositoryRoot, "resources");
	try {
		const legacyStat = await stat(legacyPath);
		if (!legacyStat.isDirectory()) {
			return failure("invalid", `The legacy Bram state path is not a directory: ${legacyPath}`);
		}
		return { ok: true, value: { name: "resources", path: legacyPath } };
	} catch (cause) {
		if (errorCode(cause) === "ENOENT") {
			return failure("missing", "No .bram or resources state directory exists in the registered project.");
		}
		return failure("unavailable", `Could not inspect the legacy Bram state path: ${causeMessage(cause)}`);
	}
}

function parseFiles(item: Record<string, unknown>, index: number): ReadResult<string[]> {
	let files: unknown;
	if (item.files !== undefined) {
		if (!Array.isArray(item.files)) {
			return failure("invalid", `Worklist item ${index + 1} has an invalid files field.`);
		}
		files = item.files;
	} else if (item.file !== undefined) {
		files = [item.file];
	} else {
		return failure("invalid", `Worklist item ${index + 1} does not declare any files.`);
	}

	if (!Array.isArray(files) || files.length === 0 || !files.every(nonEmptyString)) {
		return failure("invalid", `Worklist item ${index + 1} must declare one or more non-empty file paths.`);
	}
	return { ok: true, value: files.map((file) => file.trim()) };
}

function parseWorklist(value: unknown): ReadResult<WorklistItem[]> {
	if (!isRecord(value) || !Array.isArray(value.items)) {
		return failure("invalid", "The worklist must be an object with an items array.");
	}

	const items: WorklistItem[] = [];
	const ids = new Set<string>();
	for (const [index, candidate] of value.items.entries()) {
		if (!isRecord(candidate) || !nonEmptyString(candidate.id)) {
			return failure("invalid", `Worklist item ${index + 1} must have a non-empty ID.`);
		}

		const id = candidate.id.trim();
		if (ids.has(id)) {
			return failure("invalid", `The worklist contains duplicate item ID "${id}".`);
		}
		ids.add(id);

		const statusValue = candidate.status ?? "proposed";
		if (statusValue !== "proposed" && statusValue !== "applied") {
			return failure("invalid", `Worklist item "${id}" has an unsupported status.`);
		}

		if (candidate.title !== undefined && typeof candidate.title !== "string") {
			return failure("invalid", `Worklist item "${id}" has an invalid title.`);
		}

		const files = parseFiles(candidate, index);
		if (!files.ok) return files;

		const title = nonEmptyString(candidate.title) ? candidate.title.trim() : id;
		items.push({
			id,
			title,
			status: statusValue as WorklistStatus,
			files: files.value,
		});
	}

	return { ok: true, value: items };
}

export class BramWorklistReader {
	async read(project: RegisteredProject): Promise<ReadResult<WorklistSnapshot>> {
		let repositoryRoot: string;
		try {
			repositoryRoot = normalizeRepositoryRoot(project.repositoryRoot);
		} catch (cause) {
			return failure("invalid", causeMessage(cause));
		}

		const stateFolder = await findStateFolder(repositoryRoot);
		if (!stateFolder.ok) return stateFolder;

		const worklistPath = join(stateFolder.value.path, "worklist.json");
		let contents: string;
		try {
			contents = await readFile(worklistPath, "utf8");
		} catch (cause) {
			if (errorCode(cause) === "ENOENT") {
				return failure("missing", `No worklist.json exists in ${stateFolder.value.name}.`);
			}
			return failure("unavailable", `Could not read the worklist: ${causeMessage(cause)}`);
		}

		let data: unknown;
		try {
			data = JSON.parse(contents) as unknown;
		} catch {
			return failure("invalid", "The worklist.json file contains malformed JSON.");
		}

		const parsed = parseWorklist(data);
		if (!parsed.ok) return parsed;
		return {
			ok: true,
			value: { stateFolder: stateFolder.value.name, items: parsed.value },
		};
	}
}
