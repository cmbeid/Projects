/**
 * Turns a directory `<input>`'s selection (offline.md's "real multi-file
 * import") into a story file plus a map of every other file, keyed by the
 * path a block's `src` would reference it with — relative to the folder
 * that was picked, not to any OS path. `webkitRelativePath` (set by the
 * `webkitdirectory` attribute) looks like `my-story/images/dock.png`; the
 * folder name itself is stripped, since a story's own `src` values never
 * include it — a story's own folder is the root, same as for a shipped one.
 */
export class FolderSelectionError extends Error {}

export interface GroupedFolderSelection {
  storyFile: File;
  assetFiles: Map<string, File>;
}

const STORY_FILE_NAME = 'story.json';

export function groupFolderSelection(fileList: FileList): GroupedFolderSelection {
  const files = Array.from(fileList);
  if (files.length === 0) throw new FolderSelectionError('No files were selected.');

  let storyFile: File | undefined;
  const assetFiles = new Map<string, File>();

  for (const file of files) {
    const relativePath = folderRelativePath(file);
    if (relativePath === STORY_FILE_NAME) {
      storyFile = file;
      continue;
    }
    assetFiles.set(relativePath, file);
  }

  if (!storyFile) {
    throw new FolderSelectionError(`No ${STORY_FILE_NAME} found at the top level of the selected folder.`);
  }

  return { storyFile, assetFiles };
}

/** `webkitRelativePath` with the top-level folder name stripped, or the file's own name if it's absent (a plain, non-directory selection). */
function folderRelativePath(file: File): string {
  const webkitPath = (file as File & { webkitRelativePath?: string }).webkitRelativePath;
  if (!webkitPath) return file.name;
  const firstSlash = webkitPath.indexOf('/');
  return firstSlash === -1 ? webkitPath : webkitPath.slice(firstSlash + 1);
}
