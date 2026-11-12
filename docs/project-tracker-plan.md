# Bram project tracker for Obsidian

## Goal

Use Obsidian as a project overview and notes surface for Bram-managed repositories. The first configured project is Bram's source repository at `~/src/bram`. A disposable sample Obsidian vault will also demonstrate the plugin with the Solitaire app at `/Users/nernst/active-teaching/365F26/project/solitaire-demo-simple` as a second Bram project.

This document is a plan only. It does not implement the plugin or modify either project repository.

## Current snapshot of Bram's repository

The read-only inspection for this plan found:

- `resources/worklist.json` has no active items (version 3).
- The visible branch is `main`, at commit `485f567` (`A Log tab tells what Bram did around your work, showing only what was asked for`). This checkout exposed one grafted commit, so it does not establish the full repository history.
- Git reports 1,010 tracked files staged for deletion (about 262,680 lines). The intent is unknown. The tracker should present this as a dirty repository state and never interpret it as completed progress.
- Bram's local history search endpoint was unavailable, so this snapshot is limited to the files and Git state that could be read locally.

Recheck these facts when implementing; they are a snapshot, not project targets.

## Key user stories

1. As a user, I can add Bram by pointing the tracker to its repository folder, `~/src/bram`, so the tracker knows which project to show.
2. As a user, I can see active worklist items and repository activity together, so I can tell what Bram is working on and whether the checkout has local changes.
3. As a user, I can open a regular Obsidian Markdown note for each project, add decisions and progress notes, and link bibliography entries with my existing Obsidian conventions.
4. As a user, I can add the Solitaire demo project and see the same project overview in a safe sample vault.
5. As a user, I can tell when a project path, worklist, or Git command cannot be read, and when the displayed snapshot was last refreshed.

## MVP features

- A project registry with display name, repository root, and linked note path. Store plugin settings with Obsidian's `loadData()` / `saveData()` methods.
- A project overview that shows proposed and applied worklist items, current branch and commit, a short recent commit list, and staged / unstaged / untracked file counts.
- A project note link. Notes remain ordinary Markdown files in the vault; bibliography links stay ordinary wikilinks or citation-plugin syntax.
- Refresh when the view opens and a manual refresh action. Show the last refresh time and readable missing/stale-data states.
- Read-only access to Bram state and Git. The plugin does not edit `worklist.json`, stage files, or commit changes.

Do not show a completion percentage. A Bram worklist describes currently active work, not a fixed project backlog, and completed items may be pruned. Show active counts and repository activity instead. A later plan can define a roadmap or milestone source if a completion ratio becomes useful.

## Data and design approach

Keep a small registry in plugin settings. Each registered project points to a local repository root and an Obsidian note. Separate the readers from the view so the plan can be implemented and checked in small parts:

- **Bram reader:** locate the active state folder (`.bram/` when present, otherwise `resources/`), parse `worklist.json`, validate its shape, and expose item IDs, titles, statuses, and declared files. Treat missing or malformed data as an explicit view state.
- **Git reader:** use shell-free, read-only invocations such as `git -C <root> status --porcelain=v1 -b` and a bounded `git log` query. Report branch, recent commits, and working-tree counts. Never run mutating Git commands.
- **Project view:** combine those snapshots without pretending they are a single progress score. Keep the staged and unstaged counts prominent enough that a large dirty tree is visible, while leaving individual filenames behind an expandable detail.
- **Notes and bibliography:** open the configured Markdown note using Obsidian's workspace/link APIs. Let Obsidian manage note links; the plugin does not define a bibliography format.

## Obsidian plugin mechanism

Obsidian community plugins are written in TypeScript and bundled to `main.js`. A `manifest.json` identifies the plugin, and Obsidian loads it from the vault's `.obsidian/plugins/<id>` directory. The plugin's `onload()` method registers its command and workspace view; plugin settings can be persisted with `loadData()` and `saveData()`.

The Vault API is intended for files inside the vault. Since `~/src/bram` and the Solitaire project are external local folders, reading their worklists and Git state requires Node.js filesystem/process APIs. Those APIs are desktop-only, so the first version should set `isDesktopOnly: true`. Keep external reads limited to project paths the user explicitly registers. Use the Obsidian Vault API for the vault-resident notes.

Official references: [Build a plugin](https://docs.obsidian.md/Plugins/Getting%20started/Build%20a%20plugin), [Manifest](https://docs.obsidian.md/Reference/Manifest), [Vault API](https://docs.obsidian.md/Plugins/Vault), and [plugin submission requirements](https://docs.obsidian.md/community-directory/submission-requirements-for-plugins).

## Sample vault and demo project

Create a separate, disposable Obsidian vault for development and demonstration, rather than using the user's main vault. Install or link the development build there and configure two project entries:

1. **Bram** — `~/src/bram`, demonstrating an empty active worklist alongside a dirty Git checkout.
2. **Solitaire demo** — `/Users/nernst/active-teaching/365F26/project/solitaire-demo-simple`, demonstrating a typical Bram-managed app with a linked project note and bibliography references.

Before implementation, check whether the Solitaire project already has a suitable Bram worklist. If demonstration entries are needed, use a separate copy or fixture; do not add demo work to the original app checkout. The implementation plan should record the sample vault's chosen path and repeatable setup steps.

## Implementation sequence

1. Bootstrap the Obsidian plugin scaffold: manifest, TypeScript entry point, build scripts, styles, and setup documentation.
2. Add the project registry and validated, read-only readers for Bram worklists and Git status/log output.
3. Build the workspace overview, refresh states, and links to project notes.
4. Create the disposable sample vault, configure the Bram and Solitaire projects, and prepare isolated demo data if needed.
5. Walk through the sample vault and verify the view against both real repository states, including Bram's dirty worktree and missing or malformed-data cases.

## Decisions to confirm during implementation

- The location of the disposable sample vault.
- Whether the Solitaire checkout already has enough worklist data for a useful demonstration, or needs a separate copy/fixture.
- Which Obsidian versions to support and the resulting `minAppVersion`.
- Whether a later version should read `worklist-history` for a recent completed/dropped activity feed. The MVP uses active worklist items and Git activity only.
