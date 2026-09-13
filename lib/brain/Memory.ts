export type HistoricalLot = {
  lotCode: string;

  cookingHours: number;

  fermentationHours: number;

  averagePH: number;

  finalAlcohol: number;

  kilosAgave: number;

  litersProduced: number;

  costPerLiter: number;

  quality: "EXCELENTE" | "BUENA" | "REGULAR" | "MALA";
};

export class Memory {

  static compareLot(
    current: HistoricalLot,
    history: HistoricalLot[]
  ) {

    if (history.length === 0) {
      return null;
    }

    let best = history[0];

    let similarity = 0;

    history.forEach((lot) => {

      let score = 0;

      score +=
        100 -
        Math.abs(
          lot.cookingHours -
          current.cookingHours
        );

      score +=
        100 -
        Math.abs(
          lot.fermentationHours -
          current.fermentationHours
        );

      score +=
        100 -
        Math.abs(
          lot.finalAlcohol -
          current.finalAlcohol
        ) * 10;

      if (score > similarity) {
        similarity = score;
        best = lot;
      }

    });

    return {

      similarLot: best,

      similarity,

    };

  }

}