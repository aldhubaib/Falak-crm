export type ScriptListItem = {
  id: string;
  title: string;
  status: string;
  projectId: string;
  /** Null when the referenced project was deleted — there is no foreign key. */
  projectName: string | null;
  sourceCount: number;
  updatedAt: number;
};

export type SourceSummary = {
  id: string;
  type: string;
  url: string | null;
  title: string | null;
  author: string | null;
  trustLevel: number;
  language: string | null;
  captionKind: string | null;
  status: string;
  error: string | null;
  words: number;
  /** Timed cues present, so facts from this source can deep-link to the video. */
  hasTimestamps: boolean;
  preview: string | null;
};

export type ScriptDetail = {
  id: string;
  title: string;
  status: string;
  projectId: string;
  projectName: string | null;
  targetMinutes: number | null;
  updatedAt: number;
  sources: SourceSummary[];
};
