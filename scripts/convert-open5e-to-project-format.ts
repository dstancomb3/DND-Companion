// Conversion script: Open5e/5e-bits to project format
// Usage: ts-node scripts/convert-open5e-to-project-format.ts <inputDir> <outputDir>
import fs from 'fs';
import path from 'path';

function readJSON(filePath: string) {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function writeJSON(filePath: string, data: any) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function convertClass(open5eClass: any) {
  // Example: Map Open5e class to project format
  return {
    name: open5eClass.name,
    hitDie: open5eClass.hit_dice,
    subclasses: open5eClass.subclasses?.map((sc: any) => sc.name) || [],
    features: open5eClass.class_features?.map((f: any) => f.name) || [],
    // Add more mappings as needed
  };
}

function convertRace(open5eRace: any) {
  return {
    name: open5eRace.name,
    ability_bonuses: open5eRace.ability_bonuses,
    traits: open5eRace.traits?.map((t: any) => t.name) || [],
    // Add more mappings as needed
  };
}

function main() {
  const [,, inputDir, outputDir] = process.argv;
  if (!inputDir || !outputDir) {
    console.error('Usage: ts-node scripts/convert-open5e-to-project-format.ts <inputDir> <outputDir>');
    process.exit(1);
  }
  fs.mkdirSync(outputDir, { recursive: true });

  // Classes
  const classesPath = path.join(inputDir, 'classes.json');
  if (fs.existsSync(classesPath)) {
    const open5eClassesRaw = readJSON(classesPath);
    const open5eClasses = Array.isArray(open5eClassesRaw)
      ? open5eClassesRaw
      : (open5eClassesRaw.results || open5eClassesRaw.data?.results || []);
    const projectClasses = open5eClasses.map(convertClass);
    writeJSON(path.join(outputDir, 'classProgressions.json'), projectClasses);
    console.log('Converted classes to classProgressions.json');
  }

  // Races
  const racesPath = path.join(inputDir, 'races.json');
  if (fs.existsSync(racesPath)) {
    const open5eRacesRaw = readJSON(racesPath);
    const open5eRaces = Array.isArray(open5eRacesRaw)
      ? open5eRacesRaw
      : (open5eRacesRaw.results || open5eRacesRaw.data?.results || []);
    const projectRaces = open5eRaces.map(convertRace);
    writeJSON(path.join(outputDir, 'races.json'), projectRaces);
    console.log('Converted races to races.json');
  }
}

main();
