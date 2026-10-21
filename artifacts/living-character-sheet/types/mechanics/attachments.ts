import type { MechanicDefinition, MechanicReference } from "./definitions";
import type { ReviewState, UnsupportedSegment } from "./review";
import type { MechanicsCompatibilitySource, MechanicsOwnerType, MechanicsSchemaVersion, ParserMechanicResultKind } from "./enums";

export interface MechanicsCompatibilityMetadata {
  migratedFrom?: MechanicsCompatibilitySource;
  parserOriginKind?: ParserMechanicResultKind;
  legacyEffectCount?: number;
  legacyAdditionalDamageCount?: number;
  preservedLegacyFields?: string[];
  notes?: string[];
}

interface MechanicsBlockBase<TOwner extends MechanicsOwnerType> {
  schemaVersion: MechanicsSchemaVersion;
  ownerType: TOwner;
  mechanics: MechanicDefinition[];
  review: ReviewState;
  references?: MechanicReference[];
  compatibility?: MechanicsCompatibilityMetadata;
  unresolvedSegments?: UnsupportedSegment[];
}

export interface ItemMechanicsBlock extends MechanicsBlockBase<"item"> {
  exportedFrom?: string;
}

export interface CharacterMechanicsBlock extends MechanicsBlockBase<"character"> {
  grantedSpells?: MechanicReference[];
  grantedFeatures?: MechanicReference[];
  grantedActions?: MechanicReference[];
}