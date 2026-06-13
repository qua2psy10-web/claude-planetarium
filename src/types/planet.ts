export interface PlanetData {
  name: string;
  nameJa: string;
  altitude: number;  // degrees
  azimuth: number;   // degrees
  ra: number;        // degrees
  dec: number;       // degrees
  magnitude: number;
  body: string;      // astronomy-engine Body name
}
