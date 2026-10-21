# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Contains a Living Character Sheet mobile app (Expo React Native) and a shared API server.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Artifacts

### Living Character Sheet (`artifacts/living-character-sheet`)
- **Type**: Expo React Native mobile app
- **Purpose**: DnD companion app — character sheet, attacks, resources, inventory, quick updates, loot review
- **Stack**: Expo Router, TypeScript, React Context, local state (AsyncStorage-ready)
- **Theme**: Dark (deep navy/purple palette)
- **Mock character**: Lyra Shadowstep — Level 7 Wood Elf Monk (Way of the Open Hand)

#### Structure
- `types/` — All TypeScript interfaces (Character, Attack, Resource, InventoryItem, ProposedInventoryItem, etc.)
- `data/mockCharacter.ts` — Mock monk character, attacks, resources, inventory
- `context/CharacterContext.tsx` — Global state; now includes `loadCharacter`, `saveCurrentCharacter`, `clearCharacter`, `hasCharacter`, `currentCharacterId`
- `context/AppSettingsContext.tsx` — Accent color + display toggles; persisted to AsyncStorage
- `utils/characterStorage.ts` — AsyncStorage CRUD for multi-character saves (`getAllCharacters`, `saveCharacter`, `deleteCharacter`, `getLastActiveId`)
- `utils/mockParser.ts` — Kept for reference; no longer called in production flows
- `utils/apiUrl.ts` — Constructs API base URL from `EXPO_PUBLIC_DOMAIN` env var
- `components/attacks/AttackCard.tsx` — Attack card with inline roll calculator
- `components/resources/ResourceRow.tsx` — Resource tracker with +/- controls and progress bar
- `components/inventory/InventoryItemRow.tsx` — Inventory item with edit/equip/delete
- `components/ui/` — Reusable UI: Card, StatRow, SectionHeader, ChipButton, AbilityBlock
- `app/index.tsx` → Landing page — New Character | My Characters | Options | Demo
- `app/characters.tsx` → Character list — tap to load, confirm-delete inline
- `app/options.tsx` → Options/theme — accent color picker + display toggles
- `app/create-character.tsx` → 4-step wizard: Identity → Ability Scores → HP/Stats → Review
- `app/(tabs)/index.tsx` → Sheet screen
- `app/(tabs)/attacks.tsx` → Attacks screen
- `app/(tabs)/resources.tsx` → Resources screen
- `app/(tabs)/inventory.tsx` → Inventory screen
- `app/(tabs)/quick-update.tsx` → Quick Update — POSTs to `/api/ai/parse-update` via real AI
- `app/loot-review.tsx` → Loot Review — uses expo-image-picker, POSTs image to `/api/ai/analyze-loot`

#### Navigation
- Initial route: `app/index.tsx` (landing page)
- `(tabs)` layout has a Home button in every tab header (auto-saves character before navigating home)
- New screens are full-screen Stack screens with headerShown: false (own custom headers)

#### Architecture notes
- Quick Update uses real AI: `POST /api/ai/parse-update` with character context
- Loot Photo uses real AI + ImagePicker: `POST /api/ai/analyze-loot` (multipart/form-data)
- Both flows converge on the same LootAnalysisResult → Loot Review → applyProposedItems pipeline
- **Multi-character storage**: AsyncStorage CRUD with `@lcs_saved_characters` key, `@lcs_last_active_id` for resume
- **AppSettings**: accent color + display toggles persisted to `@lcs_app_settings`
- `hasCharacter: false` until a character is loaded or created; landing page checks `getLastActiveId()` on mount
- Errors shown to user with retry option — no silent fallbacks to fake data

#### Party & Campaign View
- `app/party.tsx` — Party screen: Create Party, Join by code, member stat cards (HP bar, AC, conditions), Leave
- `context/PartyContext.tsx` — PartyProvider managing join/create/leave state, polling (30s interval), AsyncStorage persistence
- `utils/partyApi.ts` — API service wrapping party endpoints (create, join, sync, members, leave)
- Party button (users icon) in Sheet tab header — shows green dot indicator when in a party
- `@party_session` key in AsyncStorage — persists memberId + partyCode across app restarts

#### Weapon/Attack integration
- `InventoryItem.attackAbility` — which ability modifier to use for attack
- `InventoryItem.isProficient?: boolean` — omitted/true = add proficiency bonus; false = no proficiency
- ATK bonus computed: `abilityMod(attackAbility) + (isProficient !== false ? proficiencyBonus : 0)`
- Dynamic weapon attacks only appear when item is equipped and has `damageDice`

### API Server (`artifacts/api-server`)
- Express 5 API server
- **Dependencies**: openai (^6.27.0), multer (^2.x)
- **Env vars**: `AI_INTEGRATIONS_OPENAI_BASE_URL`, `AI_INTEGRATIONS_OPENAI_API_KEY` (auto-provisioned via Replit AI Integrations)
- `GET /api/healthz` — health check
- `POST /api/ai/parse-update` — AI text parsing; body: `{ text, characterContext }` → QuickUpdateResult JSON
- `POST /api/ai/analyze-loot` — AI vision; multipart `image` file → LootAnalysisResult JSON
- `POST /api/ai/level-up` — AI level-up advisor; body: `{ character }` → `{ newLevel, proficiencyBonus, hitDie, maxHpIncrease, newFeatures, newSpellSlots, abilityScoreImprovement, notes }`
- `POST /api/party/create` — create new party session → `{ code: "WOLF-42" }`
- `POST /api/party/join/:code` — validate party code → `{ code, memberCount }`
- `PUT /api/party/sync` — upsert member snapshot (name, class, HP, AC, conditions)
- `GET /api/party/:code/members` — fetch all party member summaries
- `DELETE /api/party/leave` — remove member from party
- Uses `gpt-4o-mini` model via Replit OpenAI AI Integration proxy
- Server listens on PORT env var; accessible at `https://<REPLIT_DEV_DOMAIN>/api/...`

#### Database Schema (lib/db)
- `party_sessions` — code (PK), created_at, last_activity_at; auto-expire after 24h of inactivity
- `party_members` — id, party_code (FK → party_sessions), character stats + conditions (JSONB)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
