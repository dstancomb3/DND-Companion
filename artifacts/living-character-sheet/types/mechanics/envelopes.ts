import type { CharacterMechanicsBlock, ItemMechanicsBlock, MechanicsCompatibilityMetadata } from "./attachments";
import type { MechanicsSchemaVersion } from "./enums";

export interface MechanicsEnvelopeMetadata {
  exportedAt?: number;
  importedAt?: number;
  sourceLabel?: string;
}

interface MechanicsImportExportEnvelopeBase<TBlock, TOwner extends "item" | "character"> {
  schemaVersion: MechanicsSchemaVersion;
  ownerType: TOwner;
  mechanics: TBlock;
  compatibility?: MechanicsCompatibilityMetadata;
  metadata?: MechanicsEnvelopeMetadata;
}

export interface ItemMechanicsImportExportEnvelope extends MechanicsImportExportEnvelopeBase<ItemMechanicsBlock, "item"> {}

export interface CharacterMechanicsImportExportEnvelope extends MechanicsImportExportEnvelopeBase<CharacterMechanicsBlock, "character"> {}

export type MechanicsImportExportEnvelope = ItemMechanicsImportExportEnvelope | CharacterMechanicsImportExportEnvelope;