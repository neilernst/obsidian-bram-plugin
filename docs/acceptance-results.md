# Acceptance results

Run date: 2026-11-13

## Environment

| Component | Observed value |
| --- | --- |
| Operating system | macOS 27.2 |
| Obsidian | 1.8.9 from the installed app bundle; whether the app was running could not be confirmed |
| Plugin | 0.1.0, repository revision `fb68f8c` |
| GitHub CLI | `gh` 2.92.0 at `/opt/homebrew/bin/gh` |
| Development vault | `/Users/nernst/src/dev`, a pre-existing development vault, not treated as disposable |
| Configured projects | `bram` at `/Users/nernst/src/bram`; `solitaire` at `/Users/nernst/active-teaching/365F26/sample_code/solitaire-demo-simple` |

The vault's plugin directory is a symlink to this plugin repository, the community-plugin list contains `bram-project-tracker`, and its data file contains the two project registrations above. These are static configuration checks; plugin runtime and settings persistence were not verified. The configured repositories were left untouched and were not used as controlled fixtures.

## Results

| Check | Status | Actual result |
| --- | --- | --- |
| TypeScript preflight | **Pass** | `npm exec -- tsc --noEmit --skipLibCheck` exited successfully. This does not verify the Obsidian UI. |
| Obsidian overview, refresh, and settings | **Blocked** | No desktop UI or screen-control surface was available, so opening the overview, changing settings, restarting Obsidian, and checking persistence were not exercised. |
| Project note navigation and `bram-project` rendering | **Blocked** | The configured vault and plugin link were inspected on disk, but no note was opened in Obsidian. |
| Worklist display and refresh fidelity | **Blocked** | No isolated fixture was created and no rendered values could be compared with `.bram/worklist.json`. |
| Git branch, commits, and file counts | **Blocked** | No rendered overview or note-block values were available for comparison with Git output. |
| GitHub CLI availability | **Pass** | `gh` 2.92.0 is installed at `/opt/homebrew/bin/gh`. |
| GitHub CLI authentication | **Blocked** | `gh auth status` reported that the saved GitHub credential is invalid. No credential or account identifier is recorded here. |
| Live GitHub issue list | **Blocked** | `gh issue list --state open --limit 20 --json number,title,state,labels,updatedAt,url,body` returned `error connecting to api.github.com`. No issue data was retrieved or recorded. |
| GitHub issue rendering, empty state, and error states | **Blocked** | The issue reader was not exercised inside Obsidian. Missing-CLI, unauthenticated, no-GitHub-context, and empty-list rendering cases remain unverified. |
| Read-only behavior | **Blocked** | The CLI preflight was read-only and no test fixtures were changed, but the overview and note block were not run, so their effects on notes, Worklist data, repositories, and GitHub issues were not checked. |

## Outcome

This is a partial preflight, not a passing acceptance run. The static vault configuration and TypeScript check passed. All UI-dependent checks remain blocked, and GitHub issue verification also needs a usable authenticated CLI and network access to `api.github.com`. No controlled fixtures were created, no project notes or repositories were modified, and no GitHub issues were changed. There were no temporary test fixtures to clean up.
