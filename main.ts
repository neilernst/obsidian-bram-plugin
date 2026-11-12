import { Plugin } from "obsidian";
import { ProjectRegistry } from "./src/project-registry";

export default class BramProjectTrackerPlugin extends Plugin {
	projectRegistry!: ProjectRegistry;

	async onload(): Promise<void> {
		this.projectRegistry = new ProjectRegistry(this);
		const result = await this.projectRegistry.load();
		if (!result.ok) {
			console.warn(`[${this.manifest.name}] ${result.error.message}`);
		}
	}
}
