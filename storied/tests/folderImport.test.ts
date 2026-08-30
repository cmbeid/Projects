// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { FolderSelectionError, groupFolderSelection } from '../src/ui/folderImport';

function fileWithPath(webkitRelativePath: string, content = 'x'): File {
  const file = new File([content], webkitRelativePath.split('/').pop()!);
  Object.defineProperty(file, 'webkitRelativePath', { value: webkitRelativePath });
  return file;
}

// jsdom implements neither DataTransfer nor a constructible FileList — the
// function under test only ever does `Array.from(fileList)`, so a plain
// array satisfies everything it actually needs.
function fileList(files: File[]): FileList {
  return files as unknown as FileList;
}

describe('groupFolderSelection', () => {
  it('separates story.json from the rest, stripping the top-level folder name', () => {
    const files = fileList([
      fileWithPath('my-story/story.json'),
      fileWithPath('my-story/images/dock.png'),
      fileWithPath('my-story/images/cover.png'),
    ]);
    const { storyFile, assetFiles } = groupFolderSelection(files);
    expect(storyFile.name).toBe('story.json');
    expect([...assetFiles.keys()].sort()).toEqual(['images/cover.png', 'images/dock.png']);
  });

  it('throws when no files were selected', () => {
    expect(() => groupFolderSelection(fileList([]))).toThrow(FolderSelectionError);
  });

  it('throws when no story.json is present', () => {
    const files = fileList([fileWithPath('my-story/images/dock.png')]);
    expect(() => groupFolderSelection(files)).toThrow(/No story\.json/);
  });

  it('only recognizes a top-level story.json, not a nested one', () => {
    const files = fileList([
      fileWithPath('my-story/nested/story.json'),
      fileWithPath('my-story/images/dock.png'),
    ]);
    expect(() => groupFolderSelection(files)).toThrow(FolderSelectionError);
  });
});
