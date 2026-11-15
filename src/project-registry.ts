import {
	isRecord,
	normalizeRepositoryRoot,
	type ReadError,
	type ReadResult,
	type RegisteredProject,
} from "./types";

interface PluginDataStore {
	loadData(): Promise<unknown>;
	saveData(data: unknown): Promise<void>;
}

interface ProjectRegistryData {
	projects: RegisteredProject[];
	githubToken: string;
}

function error(kind: ReadError["kind"], message: string): ReadError {
	return { kind, message };
}

function nonEmptyString(value: unknown): value is string {
	return typeof value === "string" && value.trim().length > 0;
}

function parseProject(value: unknown): ReadResult<RegisteredProject> {
	if (!isRecord(value)) {
		return { ok: false, error: error("invalid", "A project entry must be an object.") };
	}

	if (!nonEmptyString(value.id)) {
		return { ok: false, error: error("invalid", "A project ID must be a non-empty string.") };
	}
	if (!nonEmptyString(value.displayName)) {
		return { ok: false, error: error("invalid", "A project display name must be a non-empty string.") };
	}
	if (!nonEmptyString(value.repositoryRoot)) {
		return { ok: false, error: error("invalid", "A project repository root must be a non-empty string.") };
	}
	if (!nonEmptyString(value.notePath)) {
		return { ok: false, error: error("invalid", "A project note path must be a non-empty string.") };
	}

	let repositoryRoot: string;
	try {
		repositoryRoot = normalizeRepositoryRoot(value.repositoryRoot);
	} catch (cause) {
		const message = cause instanceof Error ? cause.message : "The repository root is invalid.";
		return { ok: false, error: error("invalid", message) };
	}

	return {
		ok: true,
		value: {
			id: value.id.trim(),
			displayName: value.displayName.trim(),
			repositoryRoot,
			notePath: value.notePath.trim(),
		},
	};
}

function parseProjects(value: unknown): ReadResult<RegisteredProject[]> {
	if (!Array.isArray(value)) {
		return { ok: false, error: error("invalid", "The project registry must contain a projects array.") };
	}

	const projects: RegisteredProject[] = [];
	const ids = new Set<string>();
	for (const [index, candidate] of value.entries()) {
		const parsed = parseProject(candidate);
		if (!parsed.ok) {
			return {
				ok: false,
				error: error("invalid", `Project ${index + 1} is invalid: ${parsed.error.message}`),
			};
		}
		if (ids.has(parsed.value.id)) {
			return {
				ok: false,
				error: error("invalid", `The project ID "${parsed.value.id}" is duplicated.`),
			};
		}
		ids.add(parsed.value.id);
		projects.push(parsed.value);
	}

	return { ok: true, value: projects };
}

function copyProjects(projects: RegisteredProject[]): RegisteredProject[] {
	return projects.map((project) => ({ ...project }));
}

export class ProjectRegistry {
	private projects: RegisteredProject[] = [];
	private githubToken = "";
	private loaded = false;
	private loadError: ReadError | null = null;

	constructor(private readonly plugin: PluginDataStore) {}

	getProjects(): RegisteredProject[] {
		return copyProjects(this.projects);
	}

	getGitHubToken(): string {
		return this.githubToken;
	}

	getLoadError(): ReadError | null {
		return this.loadError ? { ...this.loadError } : null;
	}

	async load(): Promise<ReadResult<RegisteredProject[]>> {
		let saved: unknown;
		try {
			saved = await this.plugin.loadData();
		} catch (cause) {
			return this.failLoad(error("unavailable", this.messageFor(cause, "Could not load the project registry.")));
		}

		if (saved === null || saved === undefined) {
			this.projects = [];
			this.githubToken = "";
			this.loaded = true;
			this.loadError = null;
			return { ok: true, value: [] };
		}

		if (!isRecord(saved)) {
			return this.failLoad(error("invalid", "Saved project settings must be an object."));
		}
		if (saved.githubToken !== undefined && typeof saved.githubToken !== "string") {
			return this.failLoad(error("invalid", "The saved GitHub token must be a string."));
		}

		const parsed = parseProjects(saved.projects);
		if (!parsed.ok) {
			return this.failLoad(parsed.error);
		}

		this.projects = parsed.value;
		this.githubToken = typeof saved.githubToken === "string" ? saved.githubToken.trim() : "";
		this.loaded = true;
		this.loadError = null;
		return { ok: true, value: this.getProjects() };
	}

	async setGitHubToken(value: string): Promise<ReadResult<true>> {
		const ready = this.ensureLoaded();
		if (!ready.ok) return ready;

		const token = value.trim();
		const data: ProjectRegistryData = {
			projects: copyProjects(this.projects),
			githubToken: token,
		};
		try {
			await this.plugin.saveData(data);
		} catch (cause) {
			return {
				ok: false,
				error: error("unavailable", this.messageFor(cause, "Could not save the GitHub token.")),
			};
		}

		this.githubToken = token;
		return { ok: true, value: true };
	}

	async addProject(candidate: unknown): Promise<ReadResult<RegisteredProject[]>> {
		const ready = this.ensureLoaded();
		if (!ready.ok) return ready;

		const parsed = parseProject(candidate);
		if (!parsed.ok) return parsed;
		if (this.projects.some((project) => project.id === parsed.value.id)) {
			return { ok: false, error: error("invalid", `The project ID "${parsed.value.id}" is already registered.`) };
		}

		return this.persist([...this.projects, parsed.value]);
	}

	async updateProject(candidate: unknown): Promise<ReadResult<RegisteredProject[]>> {
		const ready = this.ensureLoaded();
		if (!ready.ok) return ready;

		const parsed = parseProject(candidate);
		if (!parsed.ok) return parsed;
		const index = this.projects.findIndex((project) => project.id === parsed.value.id);
		if (index < 0) {
			return { ok: false, error: error("missing", `Project "${parsed.value.id}" is not registered.`) };
		}

		const next = copyProjects(this.projects);
		next[index] = parsed.value;
		return this.persist(next);
	}

	async removeProject(id: string): Promise<ReadResult<RegisteredProject[]>> {
		const ready = this.ensureLoaded();
		if (!ready.ok) return ready;
		if (!nonEmptyString(id)) {
			return { ok: false, error: error("invalid", "A project ID must be a non-empty string.") };
		}
		if (!this.projects.some((project) => project.id === id)) {
			return { ok: false, error: error("missing", `Project "${id}" is not registered.`) };
		}

		return this.persist(this.projects.filter((project) => project.id !== id));
	}

	/** Replace the full registry, including when stored settings need repair. */
	async replaceProjects(candidate: unknown): Promise<ReadResult<RegisteredProject[]>> {
		const parsed = parseProjects(candidate);
		if (!parsed.ok) return parsed;
		return this.persist(parsed.value);
	}

	private ensureLoaded(): ReadResult<true> {
		if (this.loaded) return { ok: true, value: true };
		return {
			ok: false,
			error: this.loadError ?? error("unavailable", "The project registry has not been loaded."),
		};
	}

	private failLoad(loadError: ReadError): ReadResult<RegisteredProject[]> {
		this.projects = [];
		this.githubToken = "";
		this.loaded = false;
		this.loadError = loadError;
		return { ok: false, error: loadError };
	}

	private async persist(projects: RegisteredProject[]): Promise<ReadResult<RegisteredProject[]>> {
		const data: ProjectRegistryData = {
			projects: copyProjects(projects),
			githubToken: this.githubToken,
		};
		try {
			await this.plugin.saveData(data);
		} catch (cause) {
			return {
				ok: false,
				error: error("unavailable", this.messageFor(cause, "Could not save the project registry.")),
			};
		}

		this.projects = copyProjects(projects);
		this.loaded = true;
		this.loadError = null;
		return { ok: true, value: this.getProjects() };
	}

	private messageFor(cause: unknown, fallback: string): string {
		return cause instanceof Error && cause.message ? `${fallback} ${cause.message}` : fallback;
	}
}
