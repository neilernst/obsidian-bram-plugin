import { execFile } from "node:child_process";
import {
	normalizeRepositoryRoot,
	type GitCommit,
	type GitFileCounts,
	type GitSnapshot,
	type ReadError,
	type ReadResult,
	type RegisteredProject,
} from "../types";

const COMMAND_TIMEOUT_MS = 10_000;
const MAX_OUTPUT_BYTES = 10 * 1024 * 1024;
const RECENT_COMMIT_LIMIT = 5;

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

		const logCommand = await runGit(repositoryRoot, [
			"log",
			`-${RECENT_COMMIT_LIMIT}`,
			"--format=%h%x09%s",
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

		return {
			ok: true,
			value: {
				branch: status.value.branch,
				head: commits[0]?.hash ?? null,
				recentCommits: commits,
				fileCounts: status.value.fileCounts,
			},
		};
	}
}
