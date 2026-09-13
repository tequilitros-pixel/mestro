export type HistoricLot = {
  lot: string;

  agaveKg: number;

  extraction: number;

  alcohol: number;

  cookingHours: number;

  cookingTemp: number;

  litersProduced: number;

  costPerLiter: number;

  score: number;

  createdAt: Date;
};

export class LotHistory {
  private static history: HistoricLot[] = [];

  static add(lot: HistoricLot) {
    this.history.push(lot);
  }

  static all() {
    return this.history;
  }

  static latest() {
    return this.history[this.history.length - 1];
  }

  static averageScore() {
    if (this.history.length === 0) return 0;

    return (
      this.history.reduce((s, l) => s + l.score, 0) /
      this.history.length
    );
  }

  static averageExtraction() {
    if (this.history.length === 0) return 0;

    return (
      this.history.reduce((s, l) => s + l.extraction, 0) /
      this.history.length
    );
  }

  static bestLot() {
    return [...this.history].sort((a, b) => b.score - a.score)[0];
  }
}