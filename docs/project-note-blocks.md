# Embedded Bram project details

Add an empty `bram-project` fenced code block to a registered project note to render its current Bram and repository details in place:

```bram-project
```

The plugin matches the note to the project registered with that note path. The block displays active Bram Worklist items and their statuses, the current branch, recent commits, and staged, unstaged, and untracked file counts. If the note is not registered or a data source cannot be read, the block shows an inline explanation.

The block also displays the five most recently updated open GitHub issues from the repository named by the project's configured local Git remote. The remote defaults to `origin`; choose another remote, such as `upstream`, in **Settings → Bram Project Tracker** when registering or editing a project. You can also edit a registered project's display name, repository path, and linked note path there. The list starts collapsed; expand it to see each issue's number, title, labels, last-updated date, link, and a short body excerpt. Pull requests and their details are excluded. It calls GitHub's read-only REST API directly; the GitHub CLI is not required. Git must still be installed and available to Obsidian for local repository details and remote lookup.

Public repositories can be read without a token. For a private repository, enter an optional fine-grained personal access token in **Settings → Bram Project Tracker** and click **Save token**. Grant access only to the repositories you need and **Issues: read-only** permission. The token is saved in the plugin's settings data, which may be included in vault backups or sync; do not put it in a note or commit it. Clear the field and save to remove the token.

The reader supports `github.com` URLs for the selected remote. It reports when that remote is missing or does not point to a supported GitHub repository, the token is invalid or lacks access, the API rate limit is reached, or GitHub cannot be reached.

The block loads when Obsidian renders the note and includes a **Refresh** button to reload the Bram Worklist, local Git details, and GitHub issues in place. It shows the last refresh time and disables the button while a refresh is running. The block is read-only: refreshing does not modify the Markdown note, the Bram Worklist, GitHub issues, or the repository.
