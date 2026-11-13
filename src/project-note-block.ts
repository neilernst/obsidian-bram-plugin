import { type App, type MarkdownPostProcessorContext, type Plugin } from "obsidian";
import { BramWorklistReader } from "./readers/bram-reader";
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

async function renderProjectBlock(
	project: RegisteredProject,
	element: HTMLElement,
	worklistReader: BramWorklistReader,
	gitReader: GitReader,
): Promise<void> {
	element.empty();
	element.addClass("bram-project-note-block");
	element.createEl("h3", { cls: "bram-project-note-block__title", text: project.displayName });
	const [worklist, git] = await Promise.all([
		safeRead("Bram Worklist", () => worklistReader.read(project)),
		safeRead("Git repository", () => gitReader.read(project)),
	]);
	renderWorklist(element, worklist);
	renderRepository(element, git);
}

export function registerProjectNoteBlock(plugin: Plugin, registry: ProjectRegistry): void {
	const worklistReader = new BramWorklistReader();
	const gitReader = new GitReader();

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
			await renderProjectBlock(project, element, worklistReader, gitReader);
		},
	);
}
