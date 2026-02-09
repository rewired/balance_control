export type MeasureState = {
  drawPile: string[];
  discardPile: string[];
  faceUp: string[]; // up to 3
  recycled: boolean;
  playsByMeasureId: Record<string, number>;
  playedThisRoundByPlayerId: Record<string, boolean>;
  handByPlayerId: Record<string, string[]>;
};