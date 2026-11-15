import { execFile } from "node:child_process";
import {
	normalizeRepositoryRoot,
	type GitCommit,
	type GitFileCounts,
	type GitLineChangePoint,
	type GitSnapshot,
	type ReadError,
	type ReadResult,
	type RegisteredProject,
} from "../types";

const COMMAND_TIMEOUT_MS = 10_000;
const MAX_OUTPUT_BYTES = 10 * 1024 * 1024;
const RECENT_COMMIT_LIMIT = 5;
const LINE_CHANGE_DAY_COUNT = 30;

interface CommandError extends Error {
	code?: number | string;
	killed?: boolean;
}

interface CommandSuccess {
	stdout: string;
}

function failure(kind: ReadError["kind"], message: string): ReadResult<never> {
	return { ok: false, error: { kind, message } };
}

function runGit(repositoryRoot: string, args: string[]): Promise<ReadResult<CommandSuccess>> {
	return new Promise((resolve) => {
		execFile(
			"git",
			["-C", repositoryRoot, ...args],
			{
				encoding: "utf8",
				maxBuffer: MAX_OUTPUT_BYTES,
				shell: false,
				timeout: COMMAND_TIMEOUT_MS,
				windowsHide: true,
			},
			(error, stdout, stderr) => {
				if (error) {
					const commandError = error as CommandError;
					const detail = String(stderr).trim() || commandError.message;
					if (commandError.code === "ENOENT") {
						resolve(failure("unavailable", "Git could not be found on this system."));
						return;
					}
					const exit = commandError.code === undefined ? "" : ` (exit ${commandError.code})`;
					resolve(failure("unavailable", `Git command failed${exit}: ${detail}`));
					return;
				}
				resolve({ ok: true, value: { stdout: String(stdout) } });
			},
		);
	});
}

function parseBranch(header: string): string | null {
	if (!header.startsWith("## ")) return null;

	const description = header.slice(3).trim();
	if (description.startsWith("No commits yet on ")) {
		return description.slice("No commits yet on ".length) || null;
	}
	if (description === "HEAD" || description.startsWith("HEAD ")) return null;

	const upstreamSeparator = description.indexOf("...");
	const branch = upstreamSeparator >= 0
		? description.slice(0, upstreamSeparator)
		: description.split(" ", 1)[0];
	return branch || null;
}

function parseStatus(stdout: string): ReadResult<{ branch: string | null; fileCounts: GitFileCounts }> {
	const lines = stdout.split(/\r?\n/);
	const header = lines.shift();
	if (!header?.startsWith("## ")) {
		return failure("invalid", "Git returned an unexpected status format.");
	}

	const fileCounts: GitFileCounts = { staged: 0, unstaged: 0, untracked: 0 };
	for (const line of lines) {
		if (line.length === 0) continue;
		if (line.length < 3) return failure("invalid", "Git returned an incomplete status entry.");

		const indexStatus = line[0];
		const worktreeStatus = line[1];
		if (indexStatus === "?" && worktreeStatus === "?") {
			fileCounts.untracked += 1;
			continue;
		}
		if (indexStatus !== " ") fileCounts.staged += 1;
		if (worktreeStatus !== " ") fileCounts.unstaged += 1;
	}

	return { ok: true, value: { branch: parseBranch(header), fileCounts } };
}

function parseCommits(stdout: string): ReadResult<GitCommit[]> {
	const lines = stdout.split(/\r?\n/).filter((line) => line.length > 0);
	const commits: GitCommit[] = [];
	for (const line of lines) {
		const separator = line.indexOf("\t");
		if (separator <= 0) {
			return failure("invalid", "Git returned an unexpected commit log format.");
		}
		commits.push({ hash: line.slice(0, separator), subject: line.slice(separator + 1) });
	}
	return { ok: true, value: commits };
}

interface LineChangeWindow {
	start: Date;
	dates: string[];
}

function localDateKey(date: Date): string {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

function createLineChangeWindow(): LineChangeWindow {
	const end = new Date();
	end.setHours(0, 0, 0, 0);
	const start = new Date(end);
	start.setDate(start.getDate() - (LINE_CHANGE_DAY_COUNT - 1));
	const dates = Array.from({ length: LINE_CHANGE_DAY_COUNT }, (_, index) => {
		const date = new Date(start);
		date.setDate(start.getDate() + index);
		return localDateKey(date);
	});
	return { start, dates };
}

function zeroLineChanges(window: LineChangeWindow): GitLineChangePoint[] {
	return window.dates.map((date) => ({ date, linesChanged: 0 }));
}

function parseLineChanges(stdout: string, window: LineChangeWindow): ReadResult<GitLineChangePoint[]> {
	const counts = new Map<string, number>();
	for (const date of window.dates) counts.set(date, 0);
	let commitTimestamp: number | null = null;
	for (const line of stdout.split(/\r?\n/)) {
		if (line.length === 0) continue;
		if (/^\d+$/.test(line)) {
			commitTimestamp = Number(line);
			if (!Number.isSafeInteger(commitTimestamp)) {
				return failure("invalid", "Git returned an invalid commit timestamp for line history.");
			}
			continue;
		}

		const numstat = /^(\d+|-)	(\d+|-)	/.exec(line);
		if (!numstat || commitTimestamp === null) {
			return failure("invalid", "Git returned an unexpected line-history format.");
		}
		if (numstat[1] === "-" || numstat[2] === "-") continue;

		const additions = Number(numstat[1]);
		const deletions = Number(numstat[2]);
		if (!Number.isSafeInteger(additions) || !Number.isSafeInteger(deletions)) {
			return failure("invalid", "Git returned an invalid line count for line history.");
		}
		const commitDate = new Date(commitTimestamp * 1000);
		if (Number.isNaN(commitDate.getTime())) {
			return failure("invalid", "Git returned an invalid commit date for line history.");
		}
		const date = localDateKey(commitDate);
		const existing = counts.get(date);
		if (existing !== undefined) {
			const total = existing + additions + deletions;
			if (!Number.isSafeInteger(total)) {
				return failure("invalid", "Git returned an out-of-range daily line count.");
			}
			counts.set(date, total);
		}
	}

	return {
		ok: true,
		value: window.dates.map((date) => ({ date, linesChanged: counts.get(date) ?? 0 })),
	};
}

export class GitReader {
	async read(project: RegisteredProject): Promise<ReadResult<GitSnapshot>> {
		let repositoryRoot: string;
		try {
			repositoryRoot = normalizeRepositoryRoot(project.repositoryRoot);
		} catch (cause) {
			const message = cause instanceof Error ? cause.message : "The repository root is invalid.";
			return failure("invalid", message);
		}

		const statusCommand = await runGit(repositoryRoot, [
			"status",
			"--porcelain=v1",
			"-b",
			"--untracked-files=all",
		]);
		if (!statusCommand.ok) return statusCommand;

		const status = parseStatus(statusCommand.value.stdout);
		if (!status.ok) return status;

		const lineChangeWindow = createLineChangeWindow();
		const [logCommand, lineChangeCommand] = await Promise.all([
			runGit(repositoryRoot, ["log", `-${RECENT_COMMIT_LIMIT}`, "--format=%h%x09%s"]),
			runGit(repositoryRoot, [
				"log",
				`--since=${lineChangeWindow.start.toISOString()}`,
				"--format=%ct",
				"--numstat",
			]),
		]);
		let commits: GitCommit[];
		if (!logCommand.ok) {
			if (!/does not have any commits yet/i.test(logCommand.error.message)) return logCommand;
			commits = [];
		} else {
			const parsedCommits = parseCommits(logCommand.value.stdout);
			if (!parsedCommits.ok) return parsedCommits;
			commits = parsedCommits.value;
		}

		let lineChanges: GitLineChangePoint[];
		if (!lineChangeCommand.ok) {
			if (!/does not have any commits yet/i.test(lineChangeCommand.error.message)) return lineChangeCommand;
			lineChanges = zeroLineChanges(lineChangeWindow);
		} else {
			const parsedLineChanges = parseLineChanges(lineChangeCommand.value.stdout, lineChangeWindow);
			if (!parsedLineChanges.ok) return parsedLineChanges;
			lineChanges = parsedLineChanges.value;
		}

		return {
			ok: true,
			value: {
				branch: status.value.branch,
				head: commits[0]?.hash ?? null,
				recentCommits: commits,
				fileCounts: status.value.fileCounts,
				lineChanges,
			},
		};
	}
}
