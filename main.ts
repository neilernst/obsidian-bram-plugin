import { Plugin } from "obsidian";
import { ProjectRegistry } from "./src/project-registry";
import { ProjectSettingsTab } from "./src/project-settings";
import { ProjectOverviewView, PROJECT_OVERVIEW_VIEW } from "./src/views/project-overview";

export default class BramProjectTrackerPlugin extends Plugin {
	projectRegistry!: ProjectRegistry;

	async onload(): Promise<void> {
		this.projectRegistry = new ProjectRegistry(this);
		const result = await this.projectRegistry.load();
		if (!result.ok) {
			console.warn(`[${this.manifest.name}] ${result.error.message}`);
		}

		this.registerView(
			PROJECT_OVERVIEW_VIEW,
			(leaf) => new ProjectOverviewView(leaf, this.projectRegistry),
		);
		this.addSettingTab(new ProjectSettingsTab(
			this.app,
			this,
			this.projectRegistry,
			() => this.refreshOpenProjectOverview(),
		));
		this.addCommand({
			id: "open-project-overview",
			name: "Open project overview",
			callback: () => void this.openProjectOverview(),
		});
		this.addCommand({
			id: "refresh-project-overview",
			name: "Refresh project overview",
			callback: () => void this.refreshProjectOverview(),
		});
	}

	private async openProjectOverview(): Promise<void> {
		const existing = this.app.workspace.getLeavesOfType(PROJECT_OVERVIEW_VIEW)[0];
		const leaf = existing ?? this.app.workspace.getLeaf(true);
		if (!existing) {
			await leaf.setViewState({ type: PROJECT_OVERVIEW_VIEW, active: true });
		}
		await this.app.workspace.revealLeaf(leaf);
	}

	private async refreshProjectOverview(): Promise<void> {
		const leaf = this.app.workspace.getLeavesOfType(PROJECT_OVERVIEW_VIEW)[0];
		if (!leaf) {
			await this.openProjectOverview();
			return;
		}
		await this.refreshOpenProjectOverview();
	}

	private async refreshOpenProjectOverview(): Promise<void> {
		const leaf = this.app.workspace.getLeavesOfType(PROJECT_OVERVIEW_VIEW)[0];
		if (!leaf) return;
		const view = leaf.view;
		if (view instanceof ProjectOverviewView) {
			await view.refresh();
		}
	}
}
