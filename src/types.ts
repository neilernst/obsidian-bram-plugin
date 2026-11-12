import { homedir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";

export interface RegisteredProject {
	id: string;
	displayName: string;
	repositoryRoot: string;
	notePath: string;
}

export type ReadErrorKind = "missing" | "invalid" | "unavailable";

export interface ReadError {
	kind: ReadErrorKind;
	message: string;
}

export type ReadResult<T> =
	| { ok: true; value: T }
	| { ok: false; error: ReadError };

export type WorklistStatus = "proposed" | "applied";

export interface WorklistItem {
	id: string;
	title: string;
	status: WorklistStatus;
	files: string[];
}

export interface WorklistSnapshot {
	stateFolder: ".bram" | "resources";
	items: WorklistItem[];
}

export interface GitCommit {
	hash: string;
	subject: string;
}

export interface GitFileCounts {
	staged: number;
	unstaged: number;
	untracked: number;
}

export interface GitSnapshot {
	branch: string | null;
	head: string | null;
	recentCommits: GitCommit[];
	fileCounts: GitFileCounts;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Expand a registered home-relative path and require an explicit root. */
export function normalizeRepositoryRoot(value: string): string {
	let candidate = value.trim();

	if (candidate === "~") {
		candidate = homedir();
	} else if (candidate.startsWith("~/") || candidate.startsWith("~\\")) {
		candidate = join(homedir(), candidate.slice(2));
	}

	if (!isAbsolute(candidate)) {
		throw new Error("Repository root must be an absolute path or start with ~.");
	}

	return resolve(candidate);
}
