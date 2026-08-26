# Orchestrator Handoff

Select a small, non-overlapping contract group from the registry. Copy its exact acceptance scenarios into the OX prompt, include every referenced `BD-*` decision and leave blocked portions disabled until authorized, name owned production/test/migration files, and require the interaction-specific activation evidence defined by each scenario. Do not ask OX to reinterpret product behavior or broaden scope.

Review the PR against `docs/agents/PR_ACCEPTANCE_REQUIREMENTS.md`, inspect the full diff and migration path, reproduce focused/full checks at the reported SHA, and return exactly one verdict: `APPROVE`, `CHANGES REQUIRED`, or `REJECT`. Never merge; the user remains final merge authority.
