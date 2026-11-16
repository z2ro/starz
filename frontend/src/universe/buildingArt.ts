import ferrite from '../../assets/buildings/concepts/ferrite_extractor.webp';
import civil from '../../assets/buildings/concepts/civil_district.webp';
import research from '../../assets/buildings/concepts/planetary_research_center.webp';
import shipyard from '../../assets/buildings/concepts/orbital_shipyard.webp';
import civilLab from '../../assets/buildings/concepts/civil_engineering_lab.webp';
import refinery from '../../assets/buildings/concepts/fuel_refinery.webp';
import fundamentalLab from '../../assets/buildings/concepts/fundamental_science_institute.webp';
import manufacturing from '../../assets/buildings/concepts/advanced_manufacturing.webp';
import militaryLab from '../../assets/buildings/concepts/military_research_complex.webp';
import processor from '../../assets/buildings/concepts/materials_processor.webp';
/** Concept art per installation; installations without art fall back to an icon. */
export const buildingArt:Record<string,string>={ore_extractor:ferrite,civil_district:civil,research_lab:research,orbital_shipyard:shipyard,civil_lab:civilLab,fuel_refinery:refinery,fundamental_lab:fundamentalLab,manufacturing,military_lab:militaryLab,processor};
