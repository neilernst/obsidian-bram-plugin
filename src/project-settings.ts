import { Notice, PluginSettingTab, Setting, type App, type Plugin } from "obsidian";
import { ProjectRegistry } from "./project-registry";
import type { RegisteredProject } from "./types";

function projectId(displayName: string, existingIds: Set<string>): string {
	const slug = displayName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "project";
	let id = slug;
	let suffix = 2;
	while (existingIds.has(id)) {
		id = `${slug}-${suffix}`;
		suffix += 1;
	}
	return id;
}

export class ProjectSettingsTab extends PluginSettingTab {
	private displayName = "";
	private repositoryRoot = "";
	private notePath = "";
	private remoteName = "origin";
	private githubToken = "";

	constructor(
		app: App,
		plugin: Plugin,
		private readonly registry: ProjectRegistry,
		private readonly onProjectsChanged: () => Promise<void>,
	) {
		super(app, plugin);
	}

	override display(): void {
		const { containerEl } = this;
		containerEl.empty();
		containerEl.createEl("h2", { text: "Bram Project Tracker" });
		containerEl.createEl("p", {
			text: "Register local repositories and link each one to a note in this vault. Repository roots can be absolute paths or start with ~.",
		});
		this.githubToken = this.registry.getGitHubToken();
		new Setting(containerEl)
			.setName("GitHub API token")
			.setDesc("Optional for public repositories. For private repositories, use a fine-grained token with Issues: read-only access. This token is stored in plugin settings and may be included in vault syncs or backups.")
			.addText((text) => {
				text.inputEl.type = "password";
				text.inputEl.autocomplete = "new-password";
				text
					.setPlaceholder("Fine-grained personal access token")
					.setValue(this.githubToken)
					.onChange((value) => { this.githubToken = value; });
			})
			.addButton((button) => button
				.setButtonText("Save token")
				.onClick(() => void this.saveGitHubToken()));

		new Setting(containerEl).setName("Add a project").setHeading();
		new Setting(containerEl)
			.setName("Display name")
			.addText((text) => text
				.setPlaceholder("Bram")
				.setValue(this.displayName)
				.onChange((value) => { this.displayName = value; }));
		new Setting(containerEl)
			.setName("Repository root")
			.setDesc("Path to the local Git repository.")
			.addText((text) => text
				.setPlaceholder("~/src/bram")
				.setValue(this.repositoryRoot)
				.onChange((value) => { this.repositoryRoot = value; }));
		new Setting(containerEl)
			.setName("Project note")
			.setDesc("Vault path or link for the project's Obsidian note, for example Projects/Bram.md.")
			.addText((text) => text
				.setPlaceholder("Projects/Bram.md")
				.setValue(this.notePath)
				.onChange((value) => { this.notePath = value; }));
		new Setting(containerEl)
			.setName("Git remote")
			.setDesc("Remote used to identify the GitHub repository for issue lookup. Defaults to origin.")
			.addText((text) => text
				.setPlaceholder("origin")
				.setValue(this.remoteName)
				.onChange((value) => { this.remoteName = value; }));
		new Setting(containerEl)
			.addButton((button) => button
				.setButtonText("Add project")
				.setCta()
				.onClick(() => this.addProject()));

		new Setting(containerEl).setName("Registered projects").setHeading();
		const projects = this.registry.getProjects();
		if (projects.length === 0) {
			containerEl.createEl("p", { text: "No projects registered yet." });
			return;
		}

		for (const project of projects) {
			let remoteName = project.remoteName;
			new Setting(containerEl)
				.setName(project.displayName)
				.setDesc(`${project.repositoryRoot}\nProject note: ${project.notePath}\nGit remote used for issue lookup.`)
				.addText((text) => text
					.setPlaceholder("origin")
					.setValue(project.remoteName)
					.onChange((value) => { remoteName = value; }))
				.addButton((button) => button
					.setButtonText("Save remote")
					.onClick(() => void this.saveProjectRemote(project, remoteName)))
				.addButton((button) => button
					.setButtonText("Remove")
					.setWarning()
					.setTooltip("Remove this project from the tracker; repository files are not changed.")
					.onClick(() => this.removeProject(project.id, project.displayName)));
		}
	}

	private async addProject(): Promise<void> {
		const displayName = this.displayName.trim();
		const repositoryRoot = this.repositoryRoot.trim();
		const notePath = this.notePath.trim();
		const remoteName = this.remoteName.trim();
		if (!displayName || !repositoryRoot || !notePath || !remoteName) {
			new Notice("Enter a display name, repository root, project note, and Git remote.");
			return;
		}

		const result = await this.registry.addProject({
			id: projectId(displayName, new Set(this.registry.getProjects().map((project) => project.id))),
			displayName,
			repositoryRoot,
			notePath,
			remoteName,
		});
		if (!result.ok) {
			new Notice(`Could not add project: ${result.error.message}`);
			return;
		}

		this.displayName = "";
		this.repositoryRoot = "";
		this.notePath = "";
		this.remoteName = "origin";
		new Notice(`Added project "${displayName}".`);
		this.display();
		await this.onProjectsChanged();
	}

	private async saveProjectRemote(project: RegisteredProject, remoteName: string): Promise<void> {
		const result = await this.registry.updateProject({ ...project, remoteName });
		if (!result.ok) {
			new Notice(`Could not save Git remote: ${result.error.message}`);
			return;
		}

		new Notice(`Saved Git remote "${remoteName.trim()}" for "${project.displayName}".`);
		this.display();
		await this.onProjectsChanged();
	}

	private async saveGitHubToken(): Promise<void> {
		const result = await this.registry.setGitHubToken(this.githubToken);
		if (!result.ok) {
			new Notice(`Could not save GitHub token: ${result.error.message}`);
			return;
		}

		new Notice(this.githubToken.trim() ? "GitHub token saved." : "GitHub token removed.");
		await this.onProjectsChanged();
	}

	private async removeProject(id: string, displayName: string): Promise<void> {
		const result = await this.registry.removeProject(id);
		if (!result.ok) {
			new Notice(`Could not remove project: ${result.error.message}`);
			return;
		}

		new Notice(`Removed project "${displayName}" from the tracker.`);
		this.display();
		await this.onProjectsChanged();
	}
}
