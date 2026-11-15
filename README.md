# Bram Project Tracker

Bram Project Tracker is an Obsidian desktop plugin for viewing project Worklists and repository activity alongside project notes.

## Features

- **Project overview:** view active Bram Worklist items, Git branch and working-tree status, recent commits, and a 30-day line-change sparkline. Refresh the overview to read current data.
- **Project notes:** add an empty `bram-project` code block to a registered project note to show its Worklist, repository details, and recent GitHub issues. The block has its own refresh button.
- **Project settings:** register a local repository and its linked note, choose which Git remote identifies its GitHub repository, and edit or remove the registration.
- **GitHub issues:** read the five most recently updated open issues through GitHub's REST API. GitHub CLI is not required. Public repositories do not need a token; private repositories require a fine-grained token with Issues read-only access.

Git must be installed and available to Obsidian. The plugin reads registered repository data and uses Git commands to inspect it. It is desktop-only because it uses Node.js filesystem and process APIs.

## Distribution status

This repository is currently private and this project is not presented as an official Community directory listing or public release. See the [distribution readiness report](docs/plugin-distribution.md) for Obsidian's submission, release, authentication, and signing guidance and the remaining owner decisions.

## Development setup

You need Node.js 20 or newer and an Obsidian desktop development vault. Use a disposable vault while developing.

Install the dependencies and start the development build:

```sh
npm install
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
