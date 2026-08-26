# P0 Legacy Extraction Report

The primary reference was cloned separately, detached at `817c6487cdbf18fc282dc0a44538d83e7bc5ef8b`, and its push URL was disabled. The extractor enumerates tracked TypeScript/JavaScript tests, Kotlin/JUnit tests, validation shell scripts, CI-only commands, and relevant architecture/migration knowledge. It records SHA-256 hashes and maps every discovered case to one or more Dusky contracts.

The manifest records 240 pinned test/CI evidence files plus five preserved local regressions (245 evidence files total), 1,148 individual entries, and 73 architecture/contract/migration knowledge files. Every inventory entry currently has the `mapped` disposition; no test disappears as obsolete or duplicate.

The reported five preserved regressions are the four modified top-level Customer contract suites plus the modified paginated-catalog suite. They share the initial modification timestamp and express regression behavior. The original working tree also contains a renamed demo-data test and two later untracked test candidates. All three are separately disclosed in the source manifest, but are not silently substituted into the reported five. No source file was changed.

Reproduce with:

```bash
node scripts/extract-legacy-tests.mjs --source /path/to/detached/Mypetnew --preserved-root /Users/trinadh/projects/mypetnew
node scripts/extract-legacy-tests.mjs --check --source /path/to/detached/Mypetnew
```

CI runs internal reconciliation without requiring credentials or a mutable reference checkout.
