# Portal review and publishing workflow

- Saved spreadsheet updates may continue to publish automatically through the workbook watchers.
- All portal layout and field-mapping changes must first be prepared in `.publisher-preview/`, never in the live root files. Run `Preview Publisher.command` to review them locally. The preview's Captain view link also remains local.
- The preview folder is ignored by Git. Do not stage, commit, push, or force-add draft files. Do not commit unpublished changes on main: a running workbook watcher pushes main.
- For field-mapping changes, keep draft importer code and generated JSON inside the preview folder (including `data/`). Do not change the running live watcher or live JSON before approval. The preview otherwise reads the latest live JSON on page refresh.
- Only when the user says **publish** for the reviewed change, promote the approved files into the live root, validate, and commit/push those files to `https://github.com/JaeM-bit/mtsc-fixtures-portal.git`. Preserve unrelated changes. Update asset version strings when promoting JavaScript or CSS.
- Keep summer and winter mappings distinct. After publishing watcher code changes, remind the user to restart the relevant watcher.
- Initialize preview files only if absent; preserve drafts across launcher restarts. Before starting a new draft after publication, sync the reviewed preview with live files without overwriting outstanding work.
