# OX Workstream Protocol

Each OX task receives a bounded set of contract IDs, file ownership, explicit non-overlap boundaries, acceptance scenarios, and required validation. Work occurs in an isolated branch/worktree. OX implements real production behavior, activates contracts in the same PR, adds all specified executable tests, and updates test paths and provenance.

The PR must report contract IDs, files changed, tests added, exact commands/results, coverage, security implications, migration impact, offline/concurrency impact, limitations, and exact head SHA. OX pushes the branch, opens the PR, and stops. OX never merges or enables auto-merge.
