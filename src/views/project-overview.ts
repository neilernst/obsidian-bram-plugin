import { ItemView, Notice, type WorkspaceLeaf } from "obsidian";
import { BramWorklistReader } from "../readers/bram-reader";
import { GitReader } from "../readers/git-reader";
import { ProjectRegistry } from "../project-registry";
import type {
	GitSnapshot,
	ProjectOverviewState,
	ReadResult,
	RegisteredProject,
	SnapshotState,
	WorklistSnapshot,
} from "../types";

export const PROJECT_OVERVIEW_VIEW = "bram-project-overview";

function emptySnapshotState<T>(): SnapshotState<T> {
	return { snapshot: null, error: null, lastSuccessAt: null };
}

function unavailable<T>(source: string, cause: unknown): ReadResult<T> {
	const detail = cause instanceof Error && cause.message ? cause.message : "Unknown error.";
	return { ok: false, error: { kind: "unavailable", message: `${source} could not be read. ${detail}` } };
}

function formatTime(timestamp: number): string {
	return new Date(timestamp).toLocaleString();
}

function formatCount(value: number): string {
	return value.toLocaleString();
}

export class ProjectOverviewView extends ItemView {
	private readonly worklistReader = new BramWorklistReader();
	private readonly gitReader = new GitReader();
	private readonly projectStates = new Map<string, ProjectOverviewState>();
	private lastRefreshAt: number | null = null;
	private refreshPromise: Promise<void> | null = null;
	private isRefreshing = false;

	constructor(
		leaf: WorkspaceLeaf,
		private readonly registry: ProjectRegistry,
	) {
		super(leaf);
		this.icon = "layout-dashboard";
		this.navigation = true;
		this.addAction("refresh-cw", "Refresh project overview", () => void this.refresh());
	}

	getViewType(): string {
		return PROJECT_OVERVIEW_VIEW;
	}

	getDisplayText(): string {
		return "Project overview";
	}

	getIcon(): string {
		return "layout-dashboard";
	}

	protected async onOpen(): Promise<void> {
		await this.refresh();
	}

	refresh(): Promise<void> {
		if (this.refreshPromise) return this.refreshPromise;

		this.isRefreshing = true;
		this.render();
		this.refreshPromise = this.refreshProjects();
		return this.refreshPromise;
	}

	private async refreshProjects(): Promise<void> {
		try {
			const projects = this.registry.getProjects();
			await Promise.all(projects.map((project) => this.refreshProject(project)));
		} finally {
			this.lastRefreshAt = Date.now();
			this.isRefreshing = false;
			this.refreshPromise = null;
			this.render();
		}
	}

	private async refreshProject(project: RegisteredProject): Promise<void> {
		const state = this.getProjectState(project);
		const [worklistResult, gitResult] = await Promise.all([
			this.safeRead("Bram worklist", () => this.worklistReader.read(project)),
			this.safeRead("Git repository", () => this.gitReader.read(project)),
		]);
		const refreshedAt = Date.now();

		if (worklistResult.ok) {
			state.worklist = { snapshot: worklistResult.value, error: null, lastSuccessAt: refreshedAt };
		} else {
			state.worklist = { ...state.worklist, error: worklistResult.error };
		}

		if (gitResult.ok) {
			state.git = { snapshot: gitResult.value, error: null, lastSuccessAt: refreshedAt };
		} else {
			state.git = { ...state.git, error: gitResult.error };
		}
	}

	private async safeRead<T>(source: string, read: () => Promise<ReadResult<T>>): Promise<ReadResult<T>> {
		try {
			return await read();
		} catch (cause) {
			return unavailable(source, cause);
		}
	}

	private getProjectState(project: RegisteredProject): ProjectOverviewState {
		const existing = this.projectStates.get(project.id);
		if (existing?.repositoryRoot === project.repositoryRoot) return existing;

		const state: ProjectOverviewState = {
			repositoryRoot: project.repositoryRoot,
			worklist: emptySnapshotState<WorklistSnapshot>(),
			git: emptySnapshotState<GitSnapshot>(),
		};
		this.projectStates.set(project.id, state);
		return state;
	}

	private render(): void {
		this.contentEl.empty();
		this.contentEl.addClass("bram-project-overview");

		const body = this.contentEl.createDiv({ cls: "bram-project-overview__body" });
		const toolbar = body.createDiv({ cls: "bram-project-overview__toolbar" });
		const refreshSummary = toolbar.createDiv({ cls: "bram-project-overview__refresh-summary" });
		refreshSummary.createEl("h1", { text: "Project overview" });
		refreshSummary.createEl("p", {
			cls: "bram-project-overview__last-refresh",
			text: this.lastRefreshAt === null
				? (this.isRefreshing ? "Refreshing project data…" : "Not refreshed yet")
				: `Last refresh: ${formatTime(this.lastRefreshAt)}${this.isRefreshing ? " · refreshing" : ""}`,
		});
		const refreshButton = toolbar.createEl("button", {
			cls: "bram-project-overview__refresh-button",
			text: this.isRefreshing ? "Refreshing…" : "Refresh",
		});
		refreshButton.disabled = this.isRefreshing;
		refreshButton.addEventListener("click", () => void this.refresh());

		const projects = this.registry.getProjects();
		if (projects.length === 0) {
			const loadError = this.registry.getLoadError();
			const empty = body.createDiv({ cls: "bram-project-overview__empty-state" });
			if (loadError) {
				empty.createEl("h2", { text: "Project registry unavailable" });
				empty.createEl("p", { text: loadError.message });
			} else {
				empty.createEl("h2", { text: "No projects registered" });
				empty.createEl("p", { text: "Add a project in the plugin settings to see its worklist and repository activity here." });
			}
			return;
		}

		for (const project of projects) {
			this.renderProject(body, project, this.getProjectState(project));
		}
	}

	private renderProject(parent: HTMLElement, project: RegisteredProject, state: ProjectOverviewState): void {
		const card = parent.createDiv({ cls: "bram-project-overview__project" });
		const header = card.createDiv({ cls: "bram-project-overview__project-header" });
		const heading = header.createDiv({ cls: "bram-project-overview__project-heading" });
		heading.createEl("h2", { text: project.displayName });
		heading.createEl("code", { cls: "bram-project-overview__root", text: project.repositoryRoot });
		const noteButton = header.createEl("button", { cls: "bram-project-overview__note-button", text: "Open project note" });
		noteButton.setAttribute("aria-label", `Open project note: ${project.notePath}`);
		noteButton.addEventListener("click", () => void this.openProjectNote(project));

		this.renderWorklist(card, state.worklist);
		this.renderRepository(card, state.git);
	}

	private renderWorklist(parent: HTMLElement, state: SnapshotState<WorklistSnapshot>): void {
		const section = parent.createDiv({ cls: "bram-project-overview__section bram-project-overview__worklist" });
		section.createEl("h3", { text: "Worklist activity" });
		this.renderFreshness(section, "Bram worklist", state);

		if (!state.snapshot) return;
		const items = state.snapshot.items;
		section.createEl("p", {
			cls: "bram-project-overview__section-summary",
			text: `${items.length} active ${items.length === 1 ? "item" : "items"} · ${state.snapshot.stateFolder}`,
		});
		if (items.length === 0) {
			section.createEl("p", { cls: "bram-project-overview__empty-copy", text: "No active worklist items." });
			return;
		}

		const list = section.createEl("ul", { cls: "bram-project-overview__worklist-items" });
		for (const item of items) {
			const row = list.createEl("li", { cls: "bram-project-overview__worklist-item" });
			const itemHeader = row.createDiv({ cls: "bram-project-overview__item-header" });
			itemHeader.createEl("strong", { text: item.title });
			itemHeader.createEl("span", {
				cls: `bram-project-overview__status bram-project-overview__status--${item.status}`,
				text: item.status,
			});
			row.createEl("code", { cls: "bram-project-overview__item-id", text: item.id });
			row.createEl("p", {
				cls: "bram-project-overview__item-files",
				text: `${item.files.length} ${item.files.length === 1 ? "file" : "files"} in scope`,
			});
		}
	}

	private renderRepository(parent: HTMLElement, state: SnapshotState<GitSnapshot>): void {
		const section = parent.createDiv({ cls: "bram-project-overview__section bram-project-overview__repository" });
		section.createEl("h3", { text: "Repository activity" });
		this.renderFreshness(section, "Git repository", state);

		if (!state.snapshot) return;
		const git = state.snapshot;
		const metrics = section.createDiv({ cls: "bram-project-overview__metrics" });
		this.renderMetric(metrics, "Branch", git.branch ?? "Detached HEAD");
		this.renderMetric(metrics, "HEAD", git.head ?? "No commits yet");
		this.renderMetric(metrics, "Staged files", formatCount(git.fileCounts.staged));
		this.renderMetric(metrics, "Unstaged files", formatCount(git.fileCounts.unstaged));
		this.renderMetric(metrics, "Untracked files", formatCount(git.fileCounts.untracked));

		section.createEl("h4", { cls: "bram-project-overview__subheading", text: "Recent commits" });
		if (git.recentCommits.length === 0) {
			section.createEl("p", { cls: "bram-project-overview__empty-copy", text: "No commits yet." });
			return;
		}

		const commits = section.createEl("ul", { cls: "bram-project-overview__commits" });
		for (const commit of git.recentCommits) {
			const row = commits.createEl("li");
			row.createEl("code", { text: commit.hash });
			row.createEl("span", { text: commit.subject });
		}
	}

	private renderFreshness<T>(parent: HTMLElement, source: string, state: SnapshotState<T>): void {
		if (state.error) {
			const message = state.snapshot && state.lastSuccessAt !== null
				? `Stale: the latest ${source} read failed (${state.error.kind}). Showing the last successful snapshot from ${formatTime(state.lastSuccessAt)}. ${state.error.message}`
				: `${source} unavailable (${state.error.kind}): ${state.error.message}`;
			parent.createEl("p", { cls: "bram-project-overview__data-state bram-project-overview__data-state--error", text: message });
			return;
		}

		if (state.lastSuccessAt !== null) {
			parent.createEl("p", { cls: "bram-project-overview__data-state", text: `${source} updated ${formatTime(state.lastSuccessAt)}.` });
		} else if (this.isRefreshing) {
			parent.createEl("p", { cls: "bram-project-overview__data-state", text: `Loading ${source.toLowerCase()}…` });
		} else {
			parent.createEl("p", { cls: "bram-project-overview__data-state", text: `${source} has not been read yet.` });
		}
	}

	private renderMetric(parent: HTMLElement, label: string, value: string): void {
		const metric = parent.createDiv({ cls: "bram-project-overview__metric" });
		metric.createEl("span", { cls: "bram-project-overview__metric-label", text: label });
		metric.createEl("strong", { cls: "bram-project-overview__metric-value", text: value });
	}

	private async openProjectNote(project: RegisteredProject): Promise<void> {
		try {
			await this.app.workspace.openLinkText(project.notePath, "", true);
		} catch (cause) {
			const detail = cause instanceof Error && cause.message ? ` ${cause.message}` : "";
			new Notice(`Could not open project note "${project.notePath}".${detail}`);
		}
	}
}
