export interface PlotChapter {
  id: string;
  number: number;
  title: string;
}

export type PlotState = "open" | "stalled" | "resolved" | "abandoned";

export interface PlotBeat {
  chapterNumber: number;
  summary: string;
  warn: string | null;
  resolves: boolean;
  abandons: boolean;
}

export interface PlotLane {
  id: string;
  name: string;
  label: string;
  ownerName: string | null;
  beats: PlotBeat[];
  lastAdvanced: number | null;
  neglect: number;
  state: PlotState;
  resolvedAt: number | null;
  colorIndex: number;
}

export interface PlotProgression {
  chapters: PlotChapter[];
  lanes: PlotLane[];
  latestChapter: number;
  completion: { resolved: number; owed: number; percent: number };
}
