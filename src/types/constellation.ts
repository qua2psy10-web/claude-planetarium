export interface ConstellationLines {
  [abbr: string]: [number, number][]
}

export interface ConstellationMeta {
  abbr: string;
  name: string;
  nameJa: string;
  mythology: string;
  centroidRa: number;  // radians
  centroidDec: number; // radians
}
