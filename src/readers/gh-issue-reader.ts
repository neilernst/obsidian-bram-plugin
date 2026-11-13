import { execFile } from "node:child_process";
import {
	isRecord,
	normalizeRepositoryRoot,
	type ReadError,
	type ReadResult,
	type RegisteredProject,
} from "../types";

const COMMAND_TIMEOUT_MS = 15_000;
const MAX_OUTPUT_BYTES = 4 * 1024 * 1024;
const ISSUE_LIMIT = 20;
const BODY_EXCERPT_LENGTH = 280;

export interface GitHubIssue {
	number: number;
	title: string;
	state: "open" | "closed";
	labels: string[];
	updatedAt: string;
	url: string;
	bodyExcerpt: string;
}

interface CommandError extends Error {
	code?: number | string;
	killed?: boolean;
}

function failure(kind: ReadError["kind"], message: string): ReadResult<never> {
	return { ok: false, error: { kind, message } };
}

function nonEmptyString(value: unknown): value is string {
	return typeof value === "string" && value.trim().length > 0;
}

function labelNames(value: unknown, issueNumber: number): ReadResult<string[]> {
	if (!Array.isArray(value)) {
		return failure("invalid", `GitHub issue #${issueNumber} has an invalid labels field.`);
	}

	const names: string[] = [];
	for (const label of value) {
		const name = typeof label === "string"
			? label
			: isRecord(label) && typeof label.name === "string"
				? label.name
				: null;
		if (name === null) {
			return failure("invalid", `GitHub issue #${issueNumber} contains an invalid label.`);
		}
		if (name.trim()) names.push(name.trim());
	}
	return { ok: true, value: names };
}

function bodyExcerpt(value: unknown, issueNumber: number): ReadResult<string> {
	if (value === null || value === undefined) return { ok: true, value: "" };
	if (typeof value !== "string") {
		return failure("invalid", `GitHub issue #${issueNumber} has an invalid body.`);
	}

	const body = value.trim();
	if (body.length <= BODY_EXCERPT_LENGTH) return { ok: true, value: body };
	return { ok: true, value: `${body.slice(0, BODY_EXCERPT_LENGTH).trimEnd()}…` };
}

function parseIssues(value: unknown): ReadResult<GitHubIssue[]> {
	if (!Array.isArray(value)) {
		return failure("invalid", "The GitHub CLI returned an unexpected issue list format.");
	}

	const issues: GitHubIssue[] = [];
	for (const [index, candidate] of value.entries()) {
		if (!isRecord(candidate)) {
			return failure("invalid", `GitHub issue ${index + 1} is not an object.`);
		}
		if (typeof candidate.number !== "number" || !Number.isInteger(candidate.number) || candidate.number < 1) {
			return failure("invalid", `GitHub issue ${index + 1} has an invalid number.`);
		}
		const issueNumber = candidate.number;
		if (!nonEmptyString(candidate.title)) {
			return failure("invalid", `GitHub issue #${issueNumber} has an invalid title.`);
		}
		if (!nonEmptyString(candidate.state)) {
			return failure("invalid", `GitHub issue #${issueNumber} has an invalid state.`);
		}
		const state = candidate.state.toLowerCase();
		if (state !== "open" && state !== "closed") {
			return failure("invalid", `GitHub issue #${issueNumber} has an unsupported state.`);
		}
		if (!nonEmptyString(candidate.updatedAt)) {
			return failure("invalid", `GitHub issue #${issueNumber} has an invalid updated date.`);
		}
		if (!nonEmptyString(candidate.url) || !/^https?:\/\//i.test(candidate.url)) {
			return failure("invalid", `GitHub issue #${issueNumber} has an invalid URL.`);
		}

		const labels = labelNames(candidate.labels, issueNumber);
		if (!labels.ok) return labels;
		const excerpt = bodyExcerpt(candidate.body, issueNumber);
		if (!excerpt.ok) return excerpt;

		issues.push({
			number: issueNumber,
			title: candidate.title.trim(),
			state,
			labels: labels.value,
			updatedAt: candidate.updatedAt.trim(),
			url: candidate.url.trim(),
			bodyExcerpt: excerpt.value,
		});
	}
	return { ok: true, value: issues };
}

function commandFailure(cause: unknown, stderr: string): ReadResult<never> {
	const commandError = cause as CommandError;
	const detail = stderr.trim() || commandError.message || "Unknown command error.";
	if (commandError.code === "ENOENT") {
		return failure("unavailable", "GitHub CLI (gh) could not be found. Install it and ensure it is available to Obsidian.");
	}
	if (commandError.killed) {
		return failure("unavailable", "The GitHub issue query timed out.");
	}
	if (/not logged in|not logged into|not authenticated|authentication|gh auth login/i.test(detail)) {
		return failure("unavailable", `GitHub CLI authentication failed. Run gh auth status and sign in if needed. ${detail}`);
	}
	if (/not a git repository|could not determine|no git remotes|not a github repository|repository .*not found/i.test(detail)) {
		return failure("unavailable", `Could not identify a GitHub repository from the registered repository root. Check its GitHub remote. ${detail}`);
	}
	const exit = commandError.code === undefined ? "" : ` (exit ${commandError.code})`;
	return failure("unavailable", `GitHub issue query failed${exit}: ${detail}`);
}

function runGh(repositoryRoot: string): Promise<ReadResult<string>> {
	return new Promise((resolve) => {
		execFile(
			"gh",
			[
				"issue",
				"list",
				"--state",
				"open",
				"--limit",
				String(ISSUE_LIMIT),
				"--json",
				"number,title,state,labels,updatedAt,url,body",
			],
			{
				cwd: repositoryRoot,
				encoding: "utf8",
				maxBuffer: MAX_OUTPUT_BYTES,
				shell: false,
				timeout: COMMAND_TIMEOUT_MS,
				windowsHide: true,
			},
			(error, stdout, stderr) => {
				if (error) {
					resolve(commandFailure(error, String(stderr)));
					return;
				}
				resolve({ ok: true, value: String(stdout) });
			},
		);
	});
}

export class GitHubIssueReader {
	async read(project: RegisteredProject): Promise<ReadResult<GitHubIssue[]>> {
		let repositoryRoot: string;
		try {
			repositoryRoot = normalizeRepositoryRoot(project.repositoryRoot);
		} catch (cause) {
			const message = cause instanceof Error ? cause.message : "The repository root is invalid.";
			return failure("invalid", message);
		}

		const command = await runGh(repositoryRoot);
		if (!command.ok) return command;

		let data: unknown;
		try {
			data = JSON.parse(command.value) as unknown;
		} catch {
			return failure("invalid", "The GitHub CLI returned malformed JSON for the issue list.");
		}
		return parseIssues(data);
	}
}
