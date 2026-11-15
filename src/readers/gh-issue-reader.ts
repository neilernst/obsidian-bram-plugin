import { execFile } from "node:child_process";
import { requestUrl } from "obsidian";
import {
	isRecord,
	normalizeRepositoryRoot,
	type ReadError,
	type ReadResult,
	type RegisteredProject,
} from "../types";

const GITHUB_API_ROOT = "https://api.github.com";
const GITHUB_API_VERSION = "2026-03-10";
const ISSUE_LIMIT = 5;
const ISSUE_PAGE_SIZE = 100;
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

interface GitHubRepository {
	owner: string;
	repository: string;
}

function failure(kind: ReadError["kind"], message: string): ReadResult<never> {
	return { ok: false, error: { kind, message } };
}

function nonEmptyString(value: unknown): value is string {
	return typeof value === "string" && value.trim().length > 0;
}

function isPullRequest(candidate: Record<string, unknown>): boolean {
	if ("pull_request" in candidate) return true;
	return typeof candidate.html_url === "string" && /\/pull\/\d+(?:[/?#]|$)/i.test(candidate.html_url);
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
		return failure("invalid", "GitHub returned an unexpected issue list format.");
	}

	const issues: GitHubIssue[] = [];
	for (const [index, candidate] of value.entries()) {
		if (!isRecord(candidate)) {
			return failure("invalid", `GitHub issue ${index + 1} is not an object.`);
		}
		// The REST issues endpoint also returns pull requests; never render their details.
		if (isPullRequest(candidate)) continue;
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
		if (!nonEmptyString(candidate.updated_at)) {
			return failure("invalid", `GitHub issue #${issueNumber} has an invalid updated date.`);
		}
		if (!nonEmptyString(candidate.html_url) || !/^https?:\/\//i.test(candidate.html_url)) {
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
			updatedAt: candidate.updated_at.trim(),
			url: candidate.html_url.trim(),
			bodyExcerpt: excerpt.value,
		});
		if (issues.length >= ISSUE_LIMIT) break;
	}
	return { ok: true, value: issues };
}

function repositoryFromRemote(remote: string): GitHubRepository | null {
	const value = remote.trim();
	let hostname: string;
	let pathname: string;

	if (value.includes("://")) {
		try {
			const url = new URL(value);
			hostname = url.hostname;
			pathname = url.pathname;
		} catch {
			return null;
		}
	} else {
		const scpStyle = /^(?:[^@/]+@)?([^:]+):(.+)$/.exec(value);
		if (!scpStyle) return null;
		const matchedHostname = scpStyle[1];
		const matchedPath = scpStyle[2];
		if (matchedHostname === undefined || matchedPath === undefined) return null;
		hostname = matchedHostname;
		pathname = `/${matchedPath}`;
	}

	if (hostname.toLowerCase() !== "github.com") return null;
	const segments = pathname.replace(/^\/+|\/+$/g, "").replace(/\.git$/i, "").split("/");
	if (segments.length !== 2) return null;
	const owner = segments[0];
	const repository = segments[1];
	if (owner === undefined || repository === undefined || !owner.trim() || !repository.trim()) return null;
	return { owner, repository };
}

function readConfiguredRemote(repositoryRoot: string, remoteName: string): Promise<ReadResult<GitHubRepository>> {
	return new Promise((resolve) => {
		execFile(
			"git",
			["-C", repositoryRoot, "remote", "get-url", remoteName],
			{ encoding: "utf8", shell: false, timeout: 10_000, windowsHide: true },
			(error, stdout) => {
				if (error) {
					const commandError = error as CommandError;
					if (commandError.code === "ENOENT") {
						resolve(failure("unavailable", "Git could not be found while locating the repository's GitHub remote."));
						return;
					}
					if (commandError.killed) {
						resolve(failure("unavailable", "Looking up the repository's GitHub remote timed out."));
						return;
					}
					resolve(failure("unavailable", `Could not read the "${remoteName}" remote. Configure that remote to point to GitHub.`));
					return;
				}

				const repository = repositoryFromRemote(String(stdout));
				if (!repository) {
					resolve(failure("unavailable", `The "${remoteName}" remote is not a supported github.com repository URL.`));
					return;
				}
				resolve({ ok: true, value: repository });
			},
		);
	});
}

function isRateLimited(headers: Record<string, string>): boolean {
	return Object.entries(headers).some(([name, value]) =>
		name.toLowerCase() === "x-ratelimit-remaining" && value === "0");
}

function httpFailure(status: number, headers: Record<string, string>, hasToken: boolean): ReadResult<never> {
	if (status === 401) {
		return failure("unavailable", "GitHub rejected the configured token. Check it in Bram Project Tracker settings.");
	}
	if (status === 403 || status === 429) {
		if (status === 429 || isRateLimited(headers)) {
			return failure("unavailable", "GitHub API rate limit reached. Try again later.");
		}
		return failure("unavailable", "GitHub denied access. Check that the token can read issues in this repository.");
	}
	if (status === 404) {
		return failure(
			"unavailable",
			hasToken
				? "GitHub repository was not found or the token cannot access it. Check the configured remote and token repository access."
				: "GitHub repository was not found. If it is private, add a read-only token in Bram Project Tracker settings.",
		);
	}
	return failure("unavailable", `GitHub issue request failed with HTTP ${status}.`);
}

async function fetchIssues(
	repository: GitHubRepository,
	token: string,
): Promise<ReadResult<GitHubIssue[]>> {
	const owner = encodeURIComponent(repository.owner);
	const name = encodeURIComponent(repository.repository);
	const headers: Record<string, string> = {
		Accept: "application/vnd.github+json",
		"X-GitHub-Api-Version": GITHUB_API_VERSION,
	};
	if (token) headers.Authorization = `Bearer ${token}`;

	const issues: GitHubIssue[] = [];
	for (let page = 1; issues.length < ISSUE_LIMIT; page += 1) {
		let response;
		try {
			response = await requestUrl({
				url: `${GITHUB_API_ROOT}/repos/${owner}/${name}/issues?state=open&per_page=${ISSUE_PAGE_SIZE}&sort=updated&direction=desc&page=${page}`,
				method: "GET",
				headers,
				throw: false,
			});
		} catch {
			return failure("unavailable", "Could not connect to GitHub. Check the network and try again.");
		}

		if (response.status < 200 || response.status >= 300) {
			return httpFailure(response.status, response.headers, token.length > 0);
		}

		let pageData: unknown;
		try {
			pageData = response.json as unknown;
		} catch {
			return failure("invalid", "GitHub returned malformed JSON for the issue list.");
		}

		const parsed = parseIssues(pageData);
		if (!parsed.ok) return parsed;
		issues.push(...parsed.value);
		if (!Array.isArray(pageData) || pageData.length < ISSUE_PAGE_SIZE) break;
	}
	return { ok: true, value: issues.slice(0, ISSUE_LIMIT) };
}

export class GitHubIssueReader {
	constructor(private readonly getToken: () => string) {}

	async read(project: RegisteredProject): Promise<ReadResult<GitHubIssue[]>> {
		let repositoryRoot: string;
		try {
			repositoryRoot = normalizeRepositoryRoot(project.repositoryRoot);
		} catch (cause) {
			const message = cause instanceof Error ? cause.message : "The repository root is invalid.";
			return failure("invalid", message);
		}

		const repository = await readConfiguredRemote(repositoryRoot, project.remoteName);
		if (!repository.ok) return repository;
		return fetchIssues(repository.value, this.getToken().trim());
	}
}
