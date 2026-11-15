# Bram Project Tracker

Bram Project Tracker is an Obsidian desktop plugin for viewing project Worklists and repository activity alongside project notes.

## Features

- **Project overview:** view active Bram Worklist items, Git branch and working-tree status, recent commits, and a 30-day line-change sparkline. Refresh the overview to read current data.
- **Project notes:** add an empty `bram-project` code block to a registered project note to show its Worklist, repository details, and recent GitHub issues. The block has its own refresh button.
- **Project settings:** register a local repository and its linked note, choose which Git remote identifies its GitHub repository, and edit or remove the registration.
- **GitHub issues:** read the five most recently updated open issues through GitHub's REST API. GitHub CLI is not required. Public repositories do not need a token; private repositories require a fine-grained token with Issues read-only access.

Git must be installed and available to Obsidian. The plugin reads registered repository data and uses Git commands to inspect it. It is desktop-only because it uses Node.js filesystem and process APIs.

## Beta release

Bram Project Tracker is being prepared for GitHub-only beta distribution, not through the Obsidian Community directory. The [GitHub releases page](https://github.com/neilernst/obsidian-bram-plugin/releases) is in a private repository, so only users with repository access can download beta releases. See the [0.1.0 beta release notes](docs/releases/0.1.0-beta.md) for installation instructions and testing guidance.

To install a beta manually, download `main.js`, `manifest.json`, and `styles.css` from the matching GitHub release, place them in your vault's configured plugin folder (by default `.obsidian/plugins/bram-project-tracker`), then enable **Bram Project Tracker** in **Settings → Community plugins**. Turn off **Restricted mode** if Obsidian prompts you before enabling community plugins.

## Privacy and security

The plugin reads the registered local repositories and uses Git commands to show repository details. Register only repositories whose local Git configuration you trust: Git's `core.fsmonitor` setting can cause `git status` to run a configured command. The plugin does not write vault notes or edit repository working files or GitHub issues; Git may refresh `.git/index` metadata while checking status.

For issue details, the plugin sends read-only requests to `api.github.com`. Public repositories do not require a token; private repositories require a fine-grained GitHub token with Issues read-only access. The token is stored in Obsidian plugin settings data and may be included in vault syncs or backups. Clear the setting and save to remove it, and revoke the token through GitHub if it may have been exposed. The plugin does not collect telemetry.

See the [distribution report](docs/plugin-distribution.md) for the GitHub beta scope and future Community directory requirements.

## Continuous integration

Pull requests targeting `main` or `master` run Obsidian's official GitHub workflow to validate, lint, and build the plugin. Release publication remains a manual, reviewed step.

## Development setup

You need Node.js 20 or newer and an Obsidian desktop development vault. Use a disposable vault while developing.

Install the dependencies and start the development build:

```sh
npm ci
npm run dev
```

The development command watches the TypeScript source and writes `main.js` in this directory. For a type-checked, minified production build, run:

```sh
npm run build
```

To load a development copy, link this repository at `.obsidian/plugins/bram-project-tracker` inside the vault. The directory name must match the plugin ID in `manifest.json`. On macOS or Linux:

```sh
mkdir -p "/path/to/dev-vault/.obsidian/plugins"
ln -s "/path/to/obsidian-bram-plugin" "/path/to/dev-vault/.obsidian/plugins/bram-project-tracker"
```

Then enable **Bram Project Tracker** under **Settings → Community plugins**. Git ignores the generated `main.js`; build it again after cloning before enabling the plugin.

## Documentation

- [Distribution readiness and publishing requirements](docs/plugin-distribution.md)
- [Security and vault-scope audit](docs/security-audit.md)
- [Embedded project note block](docs/project-note-blocks.md)
- [Acceptance testing](docs/acceptance-testing.md)
- [Project tracker design and plan](docs/project-tracker-plan.md)
