# Actions

Follow-ups from a read-through of the pnpm-workspace.yaml support as it stands on the
`pnpm-workspaces` branch. This replaces the earlier list, whose items are all resolved except the
manual verification in its item 5 — that check is item 1 here, and reading the code says it would
have failed.

Item 1 is the only one a user would notice, and the only one that should block a release. Item 3 is
done. The rest are comments that no longer describe the code.

Line references are as of `efa5b3b`.

---

## 1. Only one dependency file is decorated at a time

**Where:** `src/extension.ts:46-48` and `:67-69`, against `checkCurrentFiles` at `:107`

Keying the decoration cache per document was necessary but not sufficient. `clearDecorations()`
disposes every decoration and resets `rowToDecoration` wholesale, and both handlers that call it then
repaint exactly one document:

- `onDidChangeActiveTextEditor` clears everything, then paints `texteditor.document`
- `onDidChangeTextDocument` clears everything, then paints `e.document`

Only `checkCurrentFiles` walks all visible editors, and it runs at activation, on config change, and
from the toggle command — never on an edit or a focus change. So with a package.json and a
pnpm-workspace.yaml side by side, both paint at activation and then the first click or keystroke
blanks the other one. Clicking back and forth swaps which of the two is decorated.

This predates the yaml work in the same way the cache-key collision did: it needed two open
package.json files before, and the package.json plus pnpm-workspace.yaml pairing makes it routine.

The TODO already sitting at `src/extension.ts:45` — "is this really necessary? To clean everything."
— is asking exactly this question, and the answer is no.

Two ways out:

- Call `checkCurrentFiles(showDecorations)` in both handlers instead of `handleFileDecoration` on the
  one document. Smallest change; repaints every visible file on every edit, which is cheap because
  the npm cache is already warm.
- Scope `clearDecorations` to a document, which is now possible since the cache key carries
  `document.fileName`. Does less work, but has to get the "clear everything" callers right too.

Prefer the second if the repaint cost of the first shows up, but the first is the honest fix for the
bug and can land on its own.

Whichever lands, the regression test has to go through the paint path rather than `updateCache`
directly — `decorationCache.test.ts` pins the cache, and the cache was never the half that was
broken.

- [ ] Repaint every visible dependency file, not just the changed one
- [ ] Cover it with a test that goes through `paintDecorations`, not `updateCache`
- [ ] Answer the TODO at `src/extension.ts:45` and delete it

---

## 2. The duplicate-key comment describes behaviour we do not have

**Where:** `src/pnpmWorkspaceFile.ts:167`

The comment reads "Duplicate keys are invalid yaml, but if we ever see one we let the first win."
`getKeyLines` does let the first win. js-yaml does not — it lets the last win. So for

```yaml
catalog:
  react: ^19.0.0
  react: ^19.2.0
```

we decorate the first line with the second line's version, and an upgrade from that line then hands
`replaceVersionInWorkspaceLine` a version that is not on it, so `indexOf` fails and the line is left
untouched.

Nothing is corrupted and the file is invalid yaml either way, so this is a comment fix rather than a
behaviour fix. Say that the two disagree and that the mismatch is harmless because the replace
declines to act, or drop the sentence — but do not leave it claiming a consistency that is not there.

- [ ] Correct or remove the comment

---

## 3. `clearWorkspaceCache` is never called outside tests — DONE

**Where:** `src/workspace.ts:56`, `workspaceRootCache` at `:19`

`catalogCache` is keyed on the workspace file's mtime, so edits to a `pnpm-workspace.yaml` are picked
up on their own. `workspaceRootCache` had no such check, and it cached negatives: it stored
`undefined` for a package.json that had no workspace root above it, and deliberately treated a stored
`undefined` as a hit.

So a package.json opened before its `pnpm-workspace.yaml` exists — a fresh `pnpm init -w`, a branch
switch that adds one, a newly cloned sibling — kept resolving `catalog:` to nothing for the rest of
the session. Nothing short of a window reload cleared it.

**Resolved by not caching the miss.** The alternative was to call `clearWorkspaceCache()` from the
`onConfigChange` handler, but that only helps a user who thinks to change a setting in response to
decorations that are silently absent — it is a way out, not a fix.

Dropping the negative costs very little. We only reach `findPnpmWorkspaceRoot` for a version that
starts with `catalog:`, and a file using catalogs almost always does have a workspace root above it,
so the hit path still caches on first lookup. The miss is the rare case, and it is a handful of
`existsSync` calls up the directory tree.

That also lets `workspaceRootCache` drop to `Map<string, string>`, which removes the `undefined`
that was doing double duty as both "no root here" and "not looked up yet" — the reason the old lookup
needed a `.get()` and a `.has()` to tell them apart.

Changed:

- `findPnpmWorkspaceRoot` caches only found roots; the doc comment says why misses are not cached
- `workspaceRootCache` is `Map<string, string>`
- `should pick up a pnpm-workspace.yaml created after the first lookup` in `workspace.test.ts`, which
  resolves in a temp dir before and after writing the workspace file. It asserts on a dependency
  rather than on the root, so it holds even if an ancestor of the temp dir happens to have a
  `pnpm-workspace.yaml`. Verified to fail against the old negative-caching version.

`clearWorkspaceCache` still exists and is still test-only. That is fine now: with misses uncached,
the only stale state left is a root that was found and later deleted, and `getWorkspaceCatalog`
re-checks the file on every call and returns an empty catalog when it is gone.

- [x] Decide which, and stop a missing workspace file from being cached forever

---

## 4. The `catalog:` branch in `refreshDependencies` is unreachable

**Where:** `src/npm.ts:421`

The previous round justified keeping this branch "for the workspace-file path, whose groups keep
their versions raw". That path does not exist:

- package.json deps come from `toDependency` (`src/packageJson.ts:96`), which resolves a `catalog:`
  ref to its real version or returns `null` and drops the dep. Nothing starting with `catalog:`
  survives to `refreshDependencies`.
- a pnpm-workspace.yaml never has a `catalog:` value in the first place — a catalog does not
  reference a catalog.

It is harmless defensive code, and the `isRegistryVersion` filter right below it would catch an
unresolved ref anyway. The problem is the comment, which points at a caller that is not there. Either
delete the branch and let `isRegistryVersion` be the single guard, or keep it and say plainly that it
is a backstop rather than a live path.

- [ ] Delete the branch, or fix the justification

---

## 5. Merge keys are not resolved

**Where:** `src/util/yaml.ts:23`

`WORKSPACE_YAML_SCHEMA` adds `null` and `bool` back to the failsafe schema. `merge` is not among
them, so `<<: *base` in a catalog produces a literal `<<` key instead of merging the anchor's entries
in. It does not throw, and `<<` is not a dependency name we would fetch, so the failure is silent:
the merged-in dependencies simply get no decoration.

Worth knowing that the array form of `extend` would not fix it. `Schema.extend([type])` adds to
`explicit` only (`node_modules/js-yaml/lib/schema.js:70`), which is exactly why a bare `true` stays a
string — the property we want for versions. Resolving `<<` needs `extend({ implicit: [...] })`, which
is a different and more invasive change than the null/bool line makes it look.

Anchors in a pnpm catalog are rare enough that accepting the gap is reasonable. Just record it next
to the null/bool reasoning so the next person does not have to re-derive why `merge` is missing.

- [ ] Note the gap in the schema comment, or add `merge` via the implicit form

---

## Behaviours that are correct but surprising

Neither of these is a bug. They are here so they are not rediscovered as one.

**Catalog decorations in a package.json follow the saved workspace file.** `workspace.ts` reads from
disk and keys its cache on mtime, so unsaved edits to an open `pnpm-workspace.yaml` do not move the
decorations in a package.json next to it. Reading the buffer instead would mean reaching into
`vscode.workspace.textDocuments` from a module that is currently pure fs, for a small gain.

**A `catalog:` dependency shows an upgrade with no way to apply it.** `isCatalog` deliberately
suppresses both the quick fix and update-all on that line, because the version lives in the workspace
file. The decoration still shows what is available. That is the right split, but the user gets an
upgrade with no action attached and no hint about where to go. If it ever becomes a complaint, the
answer is a code action that opens the workspace file at the catalog entry, not an edit in place.
