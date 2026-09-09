# Actions

Follow-ups from a read-through of the pnpm-workspace.yaml support as it stands on the
`pnpm-workspaces` branch. This replaces the earlier list, whose items are all resolved except the
manual verification in its item 5 — that check is item 1 here, and reading the code says it would
have failed.

Items 1, 2, 3 and 5 are done. Nothing left here blocks a release: item 4 is a comment that no longer
describes the code.

Line references are as of `efa5b3b`.

---

## 1. Only one dependency file is decorated at a time — DONE

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

**Resolved by repainting every visible file.** Both handlers now call `checkCurrentFiles`, and
`checkCurrentFiles` owns the clear rather than leaving it to each caller. So every path that repaints
goes through one function, and that function always considers every visible editor.

The alternative was to scope `clearDecorations` to a document, which the per-document cache key now
allows. It does less work per keystroke, but the blunt clear is load-bearing in a way that is easy to
miss: a document closed and reopened comes back in a new editor with no decorations on it while its
cache entries survive, and `updateCache` would then decline to repaint a file that is showing
nothing. Making the clear narrower means answering that, probably with an
`onDidChangeVisibleTextEditors` listener. Not worth it for a repaint whose data is already cached —
the parse is the only real cost, and it is per visible dependency file, not per dependency.

Folding the clear into `checkCurrentFiles` also fixes a smaller bug in passing. The old version had
`clearDecorations()` in the `else` of a loop over visible editors, so it ran once per editor when
toggling off, and not at all when there were none.

Changed:

- `checkCurrentFiles` clears first, then returns early when decorations are off, then paints every
  visible editor. The doc comment says why it is every visible editor and why the clear stays global
- `onDidChangeActiveTextEditor` and `onDidChangeTextDocument` call it instead of clearing and then
  painting one document; the config-change handler no longer needs its own `clearDecorations()`
- the TODO at `src/extension.ts:45` is answered and gone: the clear is necessary, the single-document
  repaint after it was not
- `DecorationWrapper` carries the `fileName` it was already keyed by, and `texteditor.ts` exports
  `getDecoratedLines(document)` for tests
- `test-vscode/decorationRepaint.test.ts` opens a package.json and a pnpm-workspace.yaml side by
  side, waits for both to paint, clears, then focuses the package.json and asserts both come back

The test goes through the real paint path and the real event handler, which is what the previous
round's manual check was standing in for. Two things it has to do to be meaningful, both learned the
hard way: wait for the initial paints to settle before clearing, or an in-flight pass repaints the
second file after the clear and the test passes against the broken code; and raise the mocha timeout
past its own polling budget, or a failure reads as a generic timeout instead of naming the file that
went blank. Verified to fail against the old handler, with the message
`still undecorated: \tmp\repaint\pnpm-workspace.yaml`.

- [x] Repaint every visible dependency file, not just the changed one
- [x] Cover it with a test that goes through `paintDecorations`, not `updateCache`
- [x] Answer the TODO at `src/extension.ts:45` and delete it

---

## 2. Duplicate keys: the comment was wrong, and so was the behaviour — DONE

**Where:** `src/pnpmWorkspaceFile.ts:167`

The comment read "Duplicate keys are invalid yaml, but if we ever see one we let the first win."
`getKeyLines` does let the first win. The claim about what we would otherwise disagree with was
wrong in both directions: js-yaml does not let the last win, it refuses the document. For

```yaml
catalog:
  react: ^19.0.0
  react: ^19.2.0
```

`yaml.load` threw `duplicated mapping key (3:3)` on the options we passed then — `storeMappingPair` in
`node_modules/js-yaml/lib/loader.js:368` throws on a repeated key unless it is an overridable merge
key, and `merge` is not in `WORKSPACE_YAML_SCHEMA` (see item 5). Verified against the real schema.

`getWorkspaceFileDependencyInformation` catches that at `src/pnpmWorkspaceFile.ts:17` and returns
`[]`, and it is the only caller of `getKeyLines`. So a document with a genuine duplicate key is never
scanned at all — it decorates nothing, which is the same thing any other broken yaml does mid-edit.
There is no first-vs-last mismatch to be harmless, and no path to the `indexOf` failure the item
described.

That is a worse outcome than the comment described, and worse than what package.json does with the
same mistake: `getDependenciesFromProperty` walks the jsonc AST's `children`
(`src/packageJson.ts:46`), where each duplicate is its own node with its own offset, so both lines
decorate. The yaml path parses to a plain object first and reads lines from a separate `path → line`
map, so both structures are keyed by unique path and duplicates are collapsed before line numbers
enter the picture.

**Resolved by letting the last duplicate win, consistently.** Two changes, no new dependency:

- `WORKSPACE_YAML_OPTIONS` in `src/util/yaml.ts` replaces the bare schema export and adds
  `json: true`. In js-yaml that flag does exactly one thing — `state.json` appears twice in
  `loader.js`, once to read the option and once at the duplicate-key throw. So a repeated key no
  longer costs the whole file its decorations, and the last value wins, which is what pnpm installs.
  Both load sites (`pnpmWorkspaceFile.ts:16`, `workspace.ts:115`) go through it
- `getKeyLines` sets its map entry unconditionally instead of guarding on `has`, so the line follows
  the same last-wins rule as the value. The two now describe the same entry, which is what makes the
  quick fix work: `replaceVersionInWorkspaceLine` finds the version it was handed on the line it was
  pointed at, rather than silently returning it unchanged

The result is one decoration on the entry that actually takes effect, not the two package.json
shows. That is arguably the better behaviour rather than a shortfall — npm and pnpm both resolve a
duplicate to the last entry, so package.json's second decoration offers an upgrade for a line that
has no effect on what gets installed.

Full parity would mean decorating every occurrence, and that is not reachable from here: it needs a
value _and_ a position per occurrence, which neither the parsed object nor the line map can carry.
The way there is a positional parser — eemeli's `yaml` returns both pairs with character ranges under
`uniqueKeys: false`, and would also retire the indentation heuristic and its blind spots, and close
item 5. Not worth a dependency swap for duplicate keys alone; worth revisiting if item 5 or the
block-scalar gap ever bites.

Covered by a `duplicate keys` block in `pnpmWorkspaceFile.test.ts` — the rest of the file still
decorates, the last duplicate wins on its own line, the reported version is one
`replaceVersionInWorkspaceLine` can act on, and the same for a named catalog — plus a
`workspace.test.ts` case for `catalog:` resolution from a package.json next door. Verified against
both old behaviours: all five fail without `json: true`, and the three line-agreement ones fail with
the old first-wins guard.

- [x] Correct or remove the comment
- [x] Stop a duplicate key from blanking the whole file

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

## 5. Merge keys are not resolved — DONE

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

**Resolved by recording the gap in the schema comment.** The comment on
`WORKSPACE_YAML_SCHEMA` now says that `merge` is left out on purpose, what that costs (a `<<` key
that decorates nothing, silently), and why the array form of `extend` is not the fix — the same
`explicit`-only behaviour that keeps a bare `true` a string is what makes `<<` unresolvable without
`extend({ implicit: [...] })`. Adding it that way turns implicit resolution back on, which is the
thing the schema exists to avoid, so the gap stands.

- [x] Note the gap in the schema comment, or add `merge` via the implicit form

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
