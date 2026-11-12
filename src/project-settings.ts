import { Notice, PluginSettingTab, Setting, type App, type Plugin } from "obsidian";
import { ProjectRegistry } from "./project-registry";

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
			new Setting(containerEl)
				.setName(project.displayName)
				.setDesc(`${project.repositoryRoot}\nProject note: ${project.notePath}`)
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
		if (!displayName || !repositoryRoot || !notePath) {
			new Notice("Enter a display name, repository root, and project note.");
			return;
		}

		const result = await this.registry.addProject({
			id: projectId(displayName, new Set(this.registry.getProjects().map((project) => project.id))),
			displayName,
			repositoryRoot,
			notePath,
		});
		if (!result.ok) {
			new Notice(`Could not add project: ${result.error.message}`);
			return;
		}

		this.displayName = "";
		this.repositoryRoot = "";
		this.notePath = "";
		new Notice(`Added project "${displayName}".`);
		this.display();
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
