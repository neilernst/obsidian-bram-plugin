import { type App, type MarkdownPostProcessorContext, type Plugin } from "obsidian";
import { BramWorklistReader } from "./readers/bram-reader";
import { GitHubIssueReader, type GitHubIssue } from "./readers/gh-issue-reader";
import { GitReader } from "./readers/git-reader";
import { ProjectRegistry } from "./project-registry";
import type {
	GitSnapshot,
	ReadError,
	ReadResult,
	RegisteredProject,
	WorklistSnapshot,
} from "./types";

function noteLinkpath(notePath: string): string {
	let linkpath = notePath.trim();
	if (linkpath.startsWith("[[") && linkpath.endsWith("]]")) {
		linkpath = linkpath.slice(2, -2);
	}
	const aliasSeparator = linkpath.indexOf("|");
	if (aliasSeparator >= 0) linkpath = linkpath.slice(0, aliasSeparator);
	const headingSeparator = linkpath.indexOf("#");
	if (headingSeparator >= 0) linkpath = linkpath.slice(0, headingSeparator);
	return linkpath.trim();
}

function projectForNote(
	app: App,
	registry: ProjectRegistry,
	sourcePath: string,
): RegisteredProject | undefined {
	return registry.getProjects().find((project) => {
		const linkpath = noteLinkpath(project.notePath);
		const destination = app.metadataCache.getFirstLinkpathDest(linkpath, "");
		return destination?.path === sourcePath || (!destination && linkpath === sourcePath);
	});
}

async function safeRead<T>(
	source: string,
	read: () => Promise<ReadResult<T>>,
): Promise<ReadResult<T>> {
	try {
		return await read();
	} catch (cause) {
		const detail = cause instanceof Error && cause.message ? cause.message : "Unknown error.";
		return { ok: false, error: { kind: "unavailable", message: `${source} could not be read. ${detail}` } };
	}
}

function renderReadError(parent: HTMLElement, source: string, error: ReadError): void {
	parent.createEl("p", {
		cls: "bram-project-note-block__error",
		text: `${source} unavailable (${error.kind}): ${error.message}`,
	});
}

function renderWorklist(parent: HTMLElement, result: ReadResult<WorklistSnapshot>): void {
	const section = parent.createDiv({ cls: "bram-project-note-block__section" });
	section.createEl("h4", { text: "Bram Worklist" });
	if (!result.ok) {
		renderReadError(section, "Bram Worklist", result.error);
		return;
	}

	const items = result.value.items;
	section.createEl("p", {
		cls: "bram-project-note-block__summary",
		text: `${items.length} active ${items.length === 1 ? "item" : "items"}`,
	});
	if (items.length === 0) {
		section.createEl("p", { cls: "bram-project-note-block__empty", text: "No active Worklist items." });
		return;
	}

	const list = section.createEl("ul", { cls: "bram-project-note-block__worklist" });
	for (const item of items) {
		const row = list.createEl("li");
		const heading = row.createDiv({ cls: "bram-project-note-block__item-heading" });
		heading.createEl("strong", { text: item.title });
		heading.createEl("span", {
			cls: `bram-project-note-block__status bram-project-note-block__status--${item.status}`,
			text: item.status,
		});
		row.createEl("code", { cls: "bram-project-note-block__item-id", text: item.id });
	}
}

function renderRepository(parent: HTMLElement, result: ReadResult<GitSnapshot>): void {
	const section = parent.createDiv({ cls: "bram-project-note-block__section" });
	section.createEl("h4", { text: "Repository" });
	if (!result.ok) {
		renderReadError(section, "Git repository", result.error);
		return;
	}

	const git = result.value;
	const metrics = section.createDiv({ cls: "bram-project-note-block__metrics" });
	const values: Array<[string, string]> = [
		["Branch", git.branch ?? "Detached HEAD"],
		["HEAD", git.head ?? "No commits yet"],
		["Staged", git.fileCounts.staged.toLocaleString()],
		["Unstaged", git.fileCounts.unstaged.toLocaleString()],
		["Untracked", git.fileCounts.untracked.toLocaleString()],
	];
	for (const [label, value] of values) {
		const metric = metrics.createDiv({ cls: "bram-project-note-block__metric" });
		metric.createEl("span", { text: label });
		metric.createEl("strong", { text: value });
	}

	section.createEl("h5", { text: "Recent commits" });
	if (git.recentCommits.length === 0) {
		section.createEl("p", { cls: "bram-project-note-block__empty", text: "No commits yet." });
		return;
	}

	const commits = section.createEl("ul", { cls: "bram-project-note-block__commits" });
	for (const commit of git.recentCommits) {
		const row = commits.createEl("li");
		row.createEl("code", { text: commit.hash });
		row.createEl("span", { text: commit.subject });
	}
}

function formatIssueDate(value: string): string {
	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
}

function renderGitHubIssues(parent: HTMLElement, result: ReadResult<GitHubIssue[]>): void {
	const section = parent.createDiv({ cls: "bram-project-note-block__section" });
	section.createEl("h4", { text: "GitHub issues" });
	if (!result.ok) {
		renderReadError(section, "GitHub issues", result.error);
		return;
	}

	const issues = result.value;
	if (issues.length === 0) {
		section.createEl("p", { cls: "bram-project-note-block__empty", text: "No open GitHub issues." });
		return;
	}

	const dropdown = section.createEl("details", { cls: "bram-project-note-block__issue-dropdown" });
	dropdown.createEl("summary", { text: `Latest ${issues.length} open ${issues.length === 1 ? "issue" : "issues"}` });
	const list = dropdown.createEl("ul", { cls: "bram-project-note-block__commits" });
	for (const issue of issues) {
		const row = list.createEl("li");
		row.createEl("a", { href: issue.url, text: `#${issue.number}` });
		const details = row.createDiv();
		details.createEl("strong", { text: issue.title });
		const metadata = [
			issue.state,
			...(issue.labels.length > 0 ? [`Labels: ${issue.labels.join(", ")}`] : []),
			`Updated ${formatIssueDate(issue.updatedAt)}`,
		];
		details.createEl("p", { cls: "bram-project-note-block__summary", text: metadata.join(" · ") });
		if (issue.bodyExcerpt) {
			details.createEl("p", { text: issue.bodyExcerpt });
		}
	}
}

async function renderProjectBlock(
	project: RegisteredProject,
	element: HTMLElement,
	worklistReader: BramWorklistReader,
	gitReader: GitReader,
	githubIssueReader: GitHubIssueReader,
): Promise<void> {
	element.empty();
	element.addClass("bram-project-note-block");
	const header = element.createDiv({ cls: "bram-project-note-block__header" });
	header.createEl("h3", { cls: "bram-project-note-block__title", text: project.displayName });
	const toolbar = header.createDiv({ cls: "bram-project-note-block__toolbar" });
	const refreshStatus = toolbar.createEl("span", {
		cls: "bram-project-note-block__refresh-status",
		text: "Loading project data…",
	});
	const refreshButton = toolbar.createEl("button", {
		cls: "bram-project-note-block__refresh-button",
		text: "Refresh",
	});
	const content = element.createDiv({ cls: "bram-project-note-block__content" });
	let isRefreshing = false;
	const refresh = async (): Promise<void> => {
		if (isRefreshing) return;
		isRefreshing = true;
		refreshButton.disabled = true;
		refreshButton.textContent = "Refreshing…";
		refreshStatus.setText("Refreshing project data…");
		try {
			const [worklist, git, issues] = await Promise.all([
				safeRead("Bram Worklist", () => worklistReader.read(project)),
				safeRead("Git repository", () => gitReader.read(project)),
				safeRead("GitHub issues", () => githubIssueReader.read(project)),
			]);
			content.empty();
			renderWorklist(content, worklist);
			renderRepository(content, git);
			renderGitHubIssues(content, issues);
			refreshStatus.setText(`Last refreshed ${new Date().toLocaleTimeString()}`);
		} finally {
			isRefreshing = false;
			refreshButton.disabled = false;
			refreshButton.textContent = "Refresh";
		}
	};
	refreshButton.addEventListener("click", () => void refresh());
	await refresh();
}

export function registerProjectNoteBlock(plugin: Plugin, registry: ProjectRegistry): void {
	const worklistReader = new BramWorklistReader();
	const gitReader = new GitReader();
	const githubIssueReader = new GitHubIssueReader(() => registry.getGitHubToken());

	plugin.registerMarkdownCodeBlockProcessor(
		"bram-project",
		async (_source: string, element: HTMLElement, context: MarkdownPostProcessorContext) => {
			element.addClass("bram-project-note-block");
			const project = projectForNote(plugin.app, registry, context.sourcePath);
			if (!project) {
				element.createEl("p", {
					cls: "bram-project-note-block__error",
					text: "No registered Bram project is linked to this note.",
				});
				return;
			}
			await renderProjectBlock(project, element, worklistReader, gitReader, githubIssueReader);
		},
	);
}
