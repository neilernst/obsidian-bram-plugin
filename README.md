# Bram Project Tracker

An Obsidian plugin for viewing Bram worklists and repository activity alongside project notes and bibliography links.

The project is in its initial scaffold stage. See the [project tracker plan](docs/project-tracker-plan.md) for the user stories, design, sample vault, and implementation sequence.

## Development setup

You need Node.js 20 or newer and a disposable Obsidian development vault. Avoid using your main vault while developing plugins.

Install the dependencies and start the development build:

```sh
npm install
npm run dev
```

The development command watches the TypeScript source and writes `main.js` in this directory. For a type-checked, minified production build, run:

```sh
npm run build
```

To load the plugin in a development vault, link this repository at `.obsidian/plugins/bram-project-tracker` inside the vault. The directory name must match the plugin ID in `manifest.json`. Then enable **Bram Project Tracker** under **Settings → Community plugins**. On macOS or Linux, the link can be created with:

```sh
mkdir -p "/path/to/dev-vault/.obsidian/plugins"
ln -s "/path/to/obsidian-bram-plugin" "/path/to/dev-vault/.obsidian/plugins/bram-project-tracker"
```

Git ignores the generated `main.js`; build it again after cloning before enabling the plugin.

GitHub repository: <https://github.com/neilernst/obsidian-bram-plugin> (private).
