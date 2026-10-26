# Dynamic Soundscape Engine: Design Proposal

**Project:** D&D Companion  
**Created:** 2026-10-26  
**Status:** Proposed / parked for future implementation  
**Applies to:** AI DM one-offs, AI DM adventures/campaigns, and human-DM party sessions  
**Scope:** Design reference only. No implementation is authorized by this document.

## 1. Vision

Create an immersive, scene-aware audio system where a session's environment informs a layered soundscape. Rather than playing a single track, the app combines independently adjustable loops (wind, rain, insects, water, fire, crowd, etc.), optional music and occasional one-shot effects. Users can customize, save and reuse soundscape recipes. A human DM can control the shared scene's intended mix; AI-driven sessions can use structured scene metadata to choose and transition between profiles.

The goal is to deepen narrative immersion without replacing narrative text with visual/audio spectacle or crowding the unified session workspace.

## 2. Product principles

1. **Narrative first.** Audio complements the written/spoken unfolding scene; it never becomes a prerequisite for understanding it.
2. **One shared scene model.** The soundscape resolves from existing authoritative session/scene state where possible, not a competing audio-owned world state.
3. **Composition versus playback.** A DM/AI controls intended composition; players retain local master volume, mute and accessibility control.
4. **Consistent across modes.** AI one-off, AI campaign and human-DM party sessions use the same soundscape engine and UI primitives.
5. **Manual intent wins.** Human DM override, explicit silence, and local user mute are respected; auto scene updates must not immediately undo intentional choices.
6. **Progressive enhancement.** Gameplay and session synchronization continue when sound assets or audio playback fail.
7. **Respectful by default.** Autoplay restrictions, bandwidth limits, accessible text-only play, and mobile constraints are first-class.

## 3. Conceptual architecture

```text
Authoritative Scene / Session State
            |
     Scene Audio Descriptor
            |
     Soundscape Resolver
       /           \
  Saved Profile   Modifiers
       \           /
       Soundscape Recipe
            |
      Local Audio Mixer
     /       |        \
 Ambience   Music   One-shots
```

**Descriptor:** A structured, bounded description of location, environment, time, weather, dramatic intensity and optional specific audio cues.

**Resolver:** Maps descriptors to a curated preset plus modifiers. Deterministic, versionable, debuggable and safe with partial/unknown descriptions.

**Mixer:** Client-side playback with independently adjustable gains, looping beds, occasional randomized triggers, smooth fades and local mute. Avoid transmitting raw audio streams between participants: distribute compact scene/profile instructions and let clients mix licensed hosted assets locally.

**Authority:** Human-DM parties treat DM-published soundscape state as canonical party intent. Each client maintains private playback preferences. AI sessions derive proposals from trusted, validated AI scene output, mediated through session state rather than allowing arbitrary AI-generated paths or URLs.

## 4. Layer model

### A. Continuous ambience
Layered loops such as forest night bed, insects, wind, rain, moving water, crackling fire, crowd murmur, cave air and machinery. Each layer has independent default gain, loop metadata and crossfade parameters.

### B. Intermittent ambience
Sporadic owl calls, animal cries, branch snaps, distant footsteps, creaks, drops, rumbling or bells. Define frequency bounds, probability, variation, simultaneous-voice limits and quiet periods; use seeded or independently timed variation so loops do not feel repetitious.

### C. Music
Optional independent emotional score layer, e.g. exploration, mystery, danger, combat, resolution. Music does not have to change whenever environmental ambience changes. Respect DM/user disablement, soundtrack licensing and optional ducking around narrative speech.

### D. Event cues
Discrete one-shot effects (stone door slam, thunder strike, dragon roar, broken glass, explosion, spell discharge). Trigger on explicit scene/game events, with rate limits, duplication guards and sensible cooldowns. Avoid triggering an effect merely because a description incidentally mentions a word.

## 5. Preset library

Starter profiles could include: forest, night forest, tavern, camp, dungeon, cave, crypt, temple, city street, harbor, storm, battlefield and ancient ruins.

A profile is an editable *recipe*, not a single audio file:

```yaml
profileId: forest-night
version: 1
label: Night Forest
layers:
  - assetId: forest-night-bed
    kind: continuous
    gain: 0.55
  - assetId: foliage-wind
    kind: continuous
    gain: 0.25
  - assetId: crickets
    kind: continuous
    gain: 0.60
  - assetId: owl-call
    kind: intermittent
    gain: 0.12
    minIntervalSeconds: 30
    maxIntervalSeconds: 120
  - assetId: branch-creak
    kind: intermittent
    gain: 0.08
    minIntervalSeconds: 45
    maxIntervalSeconds: 160
music:
  enabled: false
transition:
  fadeSeconds: 4
```

Weather, time-of-day, indoor/outdoor setting, threat and specific named locations may apply modifiers to base profiles. Modifiers should be bounded and composable, with explicit precedence, rather than generating a combinatorial preset for every possible scene.

**Persistent places:** A named location can reference a stable saved preset, allowing the same tavern or hideout to maintain an identifiable acoustic character when revisited.

## 6. Session modes and ownership

| Context | Who selects composition? | Who hears it? | Local controls |
| --- | --- | --- | --- |
| Human-DM party | DM publishes preset, modifiers and cues; auto mode optional | Players who enable sound | Volume, mute, music enable |
| AI DM one-off | Validated AI scene descriptor resolved to preset; user may override | Local player(s) | Mixer, volume, manual override |
| AI DM campaign | Same engine, plus saved location associations and campaign overrides | Connected session clients as supported | Mixer, volume, manual override |

DM may select **Auto** (follow authoritative scene descriptor), **Manual** (hold a selected recipe) or **Silence** (explicit composition with no sound). Players cannot modify the party's authoritative shared scene, but can independently adjust listening levels. If player-driven custom mixes are later enabled, distinguish **personal override** from **published DM recipe** visibly.

For party sessions, publish validated recipe IDs/parameters, revision numbers and event IDs, not media streams. Reconnects should recover the latest desired persistent mix, without replaying stale one-shot cues.

## 7. AI integration contract

AI narration supplies or proposes *structured scene intent*, never filenames, unchecked URLs or raw sound commands.

```json
{
  "environment": {
    "setting": "forest",
    "timeOfDay": "night",
    "weather": "light_rain",
    "tension": "low"
  },
  "audioEvent": null
}
```

Resolver example: Night Forest + Light Rain, attenuated insects, occasional distant thunder only if warranted. When text later describes entry into underground ruins, crossfade over a bounded duration to interior stone ambience with drips and cavern air.

AI-authored one-shot cues must be drawn from an allowlisted catalogue and validated against actual authored events. They must not be automatically inferred from every narrative mention. Silence, manual overrides and explicit DM controls take priority.

**Important:** Do not make AI audio output an additional blocking step for narration, turns, rolls or combat. If AI scene metadata is absent or invalid, continue the story and retain the current mix or resolve a safe fallback.

## 8. Unified session UI

A compact persistent affordance in the session header, e.g. **Sound: Night Forest**, opens a lightweight drawer/popover. Do not consume one of the six configurable workspace regions permanently.

Proposed drawer:
- Master volume and mute/pause.
- Current profile, scene-driven Auto/Manual indicator.
- Per-layer gain sliders and enable controls.
- Optional music gain and enablement.
- Occasional sound toggles.
- Profile browser, save as preset and reset to published mix.
- DM-only: publish/broadcast controls, scene override, silence and manual event trigger palette.
- Player: local mix controls clearly distinguished from shared DM settings.

UI must be functional on mobile, keyboard-accessible and screen-reader labeled. Hide technical identifiers and engine debug information in ordinary play.

## 9. Audio lifecycle and technical design considerations

- Use browser Web Audio where supported for gain nodes, mixing, fades and sound scheduling, with graceful fallback. Confirm browser autoplay permissions through explicit user interaction; do not promise background playback where mobile OS/browser policy forbids it.
- Cache and preload a small bounded active set of sound assets; lazy-load the rest. Enforce simultaneous layer/voice limits and device/bandwidth-aware quality.
- Carefully authored, seamless loop boundaries; smooth fade and gain smoothing; prevent sudden volume spikes and layered clipping.
- Represent gains on a clear 0–100 UI scale but map to perceptually useful playback levels. Master limiter/headroom should protect against loud combined effects.
- Distinguish **stopped**, **paused**, **muted**, **playing** and **blocked by autoplay** states.
- Transition only changed layers where possible: a forest rain modifier should not restart unchanged wind/cricket loops.
- Event idempotency: apply a one-shot event at most once per client/event ID. Do not replay transient events after reconnect.
- Synchronize shared *intent*, not sample-accurate multi-device playback. Avoid promises of exact audio phase sync across participants.
- Asset provenance, licenses, attribution, download rights, and hosting cost must be tracked. Do not assume found audio is free to redistribute.
- Respect reduced sensory stimulation, local control, captions/visible event narration and no-sound play.

## 10. Proposed data model (illustrative, not a migration plan)

```ts
type SoundscapeProfile = {
  id: string;
  version: number;
  name: string;
  scope: "builtin" | "user" | "campaign";
  layers: SoundLayer[];
  music?: MusicLayer;
  transition?: { fadeMs: number };
};

type SoundscapeIntent = {
  sessionId: string;
  revision: number;
  mode: "auto" | "manual" | "silence";
  profileId: string | null;
  modifiers: Record<string, string | number | boolean>;
  publishedBy: "dm" | "ai" | "system";
};

type SoundEvent = {
  eventId: string;
  sessionId: string;
  assetId: string;
  issuedAt: string;
  optionalGain?: number;
};

type LocalAudioPreferences = {
  enabled: boolean;
  masterGain: number;
  ambienceGain: number;
  musicGain: number;
  eventsGain: number;
  mutedLayerIds: string[];
};
```

Concrete schemas should be reconciled with existing party-session authorization, event sequencing, persistence and client state before implementation. No assumed schema above overrides those existing contracts.

## 11. Phased delivery

**Phase 1: Functional local mixer**
- Curated small licensed asset catalog, several starter presets.
- Multiple continuous loops with independent gain, local master volume/mute.
- Profile selection, smooth transitions and basic saved personal presets.
- Compact drawer integrated with the unified session UI, without forcing a panel.

**Phase 2: Session authority and synchronization**
- Human-DM publish/select/silence behavior, client-local preferences.
- Versioned shared mix intent, reconnect recovery, explicit authorization and tests.
- Parity across live human-DM parties and supported AI sessions.

**Phase 3: Scene-driven intelligence**
- Structured AI/environment descriptors, resolver/modifier rules, precedence.
- Auto-to-manual override policy, weather/time transitions, named-place presets.
- Fallbacks for missing or inconsistent AI outputs.

**Phase 4: Expressiveness**
- Intermittent randomized sounds, validated one-shot cues, dedicated event palette.
- Optional adaptive music, combat/tension transitions and richer acoustic effects.

This is an ordering proposal, not a promise of delivery dates. Early work should avoid architecture that requires Phase 4 to make Phase 1 usable.

## 12. Acceptance scenarios for future implementation

1. Player selects Night Forest and hears wind and insects simultaneously; each slider changes only its intended layer.
2. Selecting Dungeon fades the forest out and fades dungeon ambience in without harsh jumps.
3. Master mute immediately silences local output without changing party intent.
4. DM sets Manual Tavern; subsequent auto environment changes do not overwrite manual composition.
5. A DM changes a party preset; connected players who opted into audio receive the updated mix while retaining their independent volume settings.
6. A newly joined or reconnecting player receives the latest current profile and does not hear expired thunder/door-slam events.
7. AI narration/roll workflows progress normally if audio is blocked, a sample fails to load, or descriptor validation rejects an unknown setting.
8. Saved location profiles reload consistently when returning to a location.
9. A one-shot effect plays no more than once per event ID.
10. Playback works or fails gracefully in supported desktop/mobile browsers, including explicit tap-to-start where required.
11. Unauthorized party members cannot publish DM-only soundscape changes.
12. A silent/no-audio play style remains fully usable and does not hide narrative-critical information.

## 13. Decisions to resolve when work resumes

- Is user-imported audio desired initially, or only curated licensed assets?
- Should personal custom layer overrides persist per scene, per campaign or globally?
- How much profile data belongs in existing campaign persistence versus user/device preferences?
- Which assets and licensing model offer reliable quality at acceptable storage and bandwidth cost?
- What degree of music adaptation is worth the cost/complexity?
- Does the product support background playback on each target mobile browser, and what are the explicit limitations?
- Which existing scene/session event surfaces can supply authoritative descriptors without introducing duplicate state?

## 14. Integration guidance for future developers

Before building, inspect the live architecture and docs for unified session workspace, party authority, AI DM scene state, event idempotency and persistence. Reuse existing components and contracts instead of making a second scene state machine. Implement incrementally behind clear capability/failure boundaries. Maintain full support for both AI-hosted and human-DM parties. Keep this feature **parked** until explicitly prioritized by the product owner.

**Core design summary:** Scene State -> Soundscape Resolver -> Client Audio Mixer. The world defines the intended sound; the local listener chooses how loudly, or whether, to hear it.
