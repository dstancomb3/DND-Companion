import { buildAiDmCampaignGuidanceSeed, buildAiDmOneOffGuidanceSeed } from "@/utils/adventure/aiDmOneOffSessionGuidance";

export type AiDmSessionFeedRole = "system" | "dm" | "player" | "tool";

export interface AiDmSessionFeedEntry {
  id: string;
  role: AiDmSessionFeedRole;
  text: string;
}

export type AiDmQuickActionKey =
  | "advance_scene"
  | "offer_choices"
  | "start_combat"
  | "resolve_turn"
  | "loot_hook"
  | "end_encounter";

export interface AiDmOneOffFeedSeedInput {
  sessionId: string;
  title: string;
  difficulty: string;
  stylePreset: string;
  guidanceText?: string;
  startInCombat: boolean;
}

export interface AiDmOneOffFeedSeedResult {
  guidanceSource: "user" | "fallback";
  entries: AiDmSessionFeedEntry[];
}

export interface AiDmCampaignFeedSeedInput {
  sessionId: string;
  campaignName: string;
  chapterTitle: string;
  difficulty: string;
  stylePreset: string;
  guidanceText?: string;
}

export function createFeedEntryId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

// ---------------------------------------------------------------------------
// Rich opening-beat generation
// ---------------------------------------------------------------------------

type EnvironmentKey = "forest" | "dungeon" | "urban" | "road" | "sea" | "ruin" | "default";

const PEACEFUL_OPENINGS: Record<EnvironmentKey, string[]> = {
  forest: [
    "Late light leans through the canopy in long amber columns, gilding the undergrowth and turning the forest floor into a patchwork of gold and deep green. The air smells of pine resin and damp earth. Somewhere above you, a pair of ravens call to each other in short, deliberate syllables — then go silent.",
    "The trees press close on either side of the path, their roots knuckling up through the soil as if claiming the ground back from whoever built this trail. Mist pools in the low places between the oaks. Something moved here recently — a broken branch at shoulder height, not old — but whatever it was has gone ahead or gone still.",
    "The forest is the kind of quiet that has weight to it. No wind, no birdsong, just the slow tick of cooling bark and the distant murmur of water you can hear but haven't found. The path narrows ahead. Someone has tied a length of red cord around a low branch at eye level — it doesn't look accidental.",
  ],
  dungeon: [
    "Torchlight reaches about ten feet in every direction and stops. The smell is old water, old stone, and something else — faint and organic — that you can't quite name. The corridor ahead runs straight to a junction you can barely make out, where the dark gets a different kind of thick.",
    "The worked stone gives way to natural rock about halfway in, where whoever built this place ran out of ambition or ran into something that made them stop. Cracks split the ceiling in a familiar pattern. You've seen that pattern before: settling. Intentional, or the result of something applied from above.",
    "Water has been moving through this level for a long time — the flagstones are worn smooth in a line down the centre of the passage, which tells you traffic used to flow in both directions. Whatever stopped that traffic is why you're here. The far end of the room is in darkness, and something in the darkness is listening.",
  ],
  urban: [
    "The street is doing what streets do: moving, smelling, arguing with itself. Two merchants are disputing weight at a stall to your left, a child is using a doorway as a shortcut, and a cat on a second-floor windowsill watches everything with professional contempt. None of that is why you're here. What drew you to this particular corner is still a few steps ahead.",
    "Lanterns on iron brackets swing slightly in a wind that doesn't reach street level — the heat from the crowd below keeps it aloft, trapped between the buildings. The cobblestones are wet from a brief shower an hour ago, and the smell of food from somewhere upwind is starting to lose the argument against the smell of the alley to your right.",
    "The city at this hour is half performance. Voices carry the way they do when people want to be heard. You pass a notice board with three fresh postings and one old one that someone has crossed out and rewritten in a different hand. The address you're looking for is close — close enough that you've started noticing who else might be heading the same direction.",
  ],
  road: [
    "The road is the kind of straight that was built with intention — old empire stone, cracked and mossy now, but still running truer than anything laid down since. Grass has taken back the verges. In the middle distance, the road bends around a low hill and disappears. The tracks in the soft shoulder tell you four riders came this way before dawn. They didn't come back.",
    "Mile markers lean at irregular angles, half their text worn away. The countryside is open here — hedgerows on both sides, sheep somewhere to the east, and a sky that looks like it's been thinking about rain since yesterday. Whatever your destination, this stretch of road is the part of the journey where thoughts tend to catch up.",
    "The crossroads has no inn, no wayshrine, nothing to recommend it except that it's where four routes converge. A fire was made here recently — the ring of stones is still warm. Someone left in a hurry, or left at a walk but didn't want to be followed. The mud around the firepit has been scuffed, possibly deliberately.",
  ],
  sea: [
    "The harbour at this hour smells of salt and industry — ropes, tar, fish scales, and the specific rot that only comes from wood that has been wet for decades. Gulls work the surface of the water with mechanical efficiency. A bell rings somewhere in the middle of the anchorage: one note, then silence, then one note again. It means something to someone.",
    "Spray off the swells catches the light and hangs for a moment before the wind takes it. The horizon is a clean line between grey water and grey sky, and you've been looking at it long enough to know there's nothing on it worth seeing — yet. What you're here for is behind you, in the town that climbs the hill above the docks.",
    "The dock is busy with the particular quiet of people doing dangerous things carefully. Cargo moves in slings from the nearest vessel, each load called down by a man in the rigging who hasn't looked up from his work in twenty minutes. You've been standing here long enough to get a read on the rhythm. The gap in that rhythm is going to be your opening.",
  ],
  ruin: [
    "Whatever this was, it was ambitious once. The outer walls reach twenty feet before they give up, and the lintel above the main entrance still carries carved relief work — eroded, but deliberate, the faces worn to suggestions of faces. Inside, vines have replaced the original flooring in the antechamber. The inner doors are gone, but the hinges remain, which means they were removed, not broken.",
    "The ruins hold silence differently than buildings do. In a building, silence means nothing is happening. Here, it means the place has had a long time to forget what noise sounds like. Something has been nesting in the upper storey — feathers, and the hollow crunch of small bones underfoot near the north-facing window.",
    "The foundation is still solid, which is either comforting or the most unsettling thing about this place, depending on your interpretation. The upper floors are a suggestion. The lower ones are intact enough to walk, and to find, and to follow the progression of damage from the outside walls inward — which tells you whatever happened here, it started at the perimeter.",
  ],
  default: [
    "This is the kind of moment that doesn't announce itself. No overture, no prologue — just circumstances that have converged on this exact point, and you standing in the middle of them. The details are in front of you. Read them.",
    "Everything that happens next begins here. The situation has a shape: there's what you can see, what you can hear, and what you're choosing not to think about yet. All three are relevant.",
    "The world has arranged this specific configuration of things and people and timing, and is waiting to see what you make of it. The last quiet moment before a decision is always exactly this long.",
  ],
};

const COMBAT_OPENINGS: Record<EnvironmentKey, string[]> = {
  forest: [
    "The undergrowth comes alive before you clear the trees — figures breaking from cover on three sides, moving low and fast, and the calculation is already running: two to the left, one flanking, something behind you that hasn't shown itself yet. You have about three seconds of geometry before this is purely reaction.",
    "An arrow passes close enough to hear. Then the shouting starts, and the shapes in the tree-shadow resolve into something you can count, if you're quick about it. The forest floor is uneven. Keep that in mind.",
  ],
  dungeon: [
    "The chamber betrays you the moment your light fills it — whatever was crouching in the dark rears up, and there's no useful distinction now between encounter and emergency. Two of them between you and the exit, one more you can hear but not see to your right.",
    "The door hadn't been open, which means something opened it. That thought is still forming when the passage ahead fills with motion — shapes resolving out of darkness faster than your torchlight can handle them.",
  ],
  urban: [
    "The crowd closes around you before the first strike lands — either deliberately, which means this was organised, or incidentally, which is worse. The street is a problem now: too many bodies, not enough angles. You pick your back to the nearest wall and start counting.",
    "Steel in the open, in daylight, in front of witnesses. They're not worried about witnesses. Figure out what that means while you're also figuring out who's fastest and where the exits are.",
  ],
  road: [
    "The ambush was patient — they let you get to the worst possible ground before they moved. Open on both sides, no cover for forty feet in any direction, and the three of them positioned so at least one always has an angle. Whoever planned this knew what they were doing.",
    "Hoofbeats coming fast from behind, figures dropping from the tree to your right, and the sound of something heavy being dragged across the road ahead to close the forward option. You have a second, maybe two, before the situation finishes arranging itself around you.",
  ],
  sea: [
    "They were already aboard when you came below — you can tell from how they're standing that they know this ship and you don't. Tight space, low beams, nowhere to run without going through one of them first.",
    "The deck tilts as the grappling hooks take hold — another ship, faster than it had any right to be, alongside in under a minute. Armed figures swarm the rail. The numbers are not in your favour and the water below is not a friendly option.",
  ],
  ruin: [
    "The ruin was occupied before you arrived. You know this because the occupants just made themselves known — movement in the upper gallery, a shape in the collapsed doorway to your left, and the sound of something heavy being dragged into position somewhere above you.",
    "Whatever lived here isn't pleased about visitors. The first one came from the shadow beneath the collapsed arch, and by the time you registered it there was already another angle to worry about.",
  ],
  default: [
    "No preamble. The threat resolved itself into action before there was time to categorise it, and the geometry of the next thirty seconds is what matters now. Count. Position. Move.",
    "It starts mid-stride, because there was never going to be a better moment to start it. The opening action belongs to whoever commits first — right now, that's them. Your first decision resets that.",
  ],
};

function stableIndex(seed: string, max: number): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return h % max;
}

function detectEnvironment(text: string): EnvironmentKey {
  const t = text.toLowerCase();
  if (/dungeon|crypt|tomb|cave|cavern|vault|cellar|underground|corridor/.test(t)) return "dungeon";
  if (/forest|woods|grove|trees|trail|bark|canopy|woodland|undergrowth/.test(t)) return "forest";
  if (/city|town|street|tavern|market|alley|district|quarter|inn|cobble|lantern/.test(t)) return "urban";
  if (/road|highway|crossroad|mile|journey|route|wayside|verge|caravan/.test(t)) return "road";
  if (/sea|ocean|harbor|harbour|port|ship|dock|coast|bay|tide|salt|vessel/.test(t)) return "sea";
  if (/ruin|ancient|crumble|fallen|deserted|abandoned|stone|arch|lintel/.test(t)) return "ruin";
  return "default";
}

function detectSocialIntent(text: string): boolean {
  return /talk|speak|parley|diplomat|negotiat|meet|ally|friend|conversat|persuad|social/.test(text.toLowerCase());
}

function buildOneOffOpeningBeat(input: {
  title: string;
  startInCombat: boolean;
  guidance: string;
}): string {
  const selectedScenario = /Scenario: (.*?)\. Location: (.*?)\. Flavor: (.*?)\. Open in/.exec(input.guidance);
  if (selectedScenario) {
    const [, scenario, location, flavor] = selectedScenario;
    const place = location.split(" — ")[0].toLowerCase();
    const when = location.split(" — ")[1] ?? "as the day draws on";
    const premise = scenario.split(" — ")[0];
    const twist = scenario.split(" — ")[1] ?? "someone knows more than they admit";
    const tone = flavor.split(" — ")[0].toLowerCase();
    const scenery = /lighthouse|coast/.test(place)
      ? "Wind drives salt spray across the stones. Far below, waves break against the rocks hard enough to rattle the glass in the lantern room."
      : /inn|tavern/.test(place)
      ? "Wet cloaks hang beside a low fire. Conversations pause whenever the front door opens, and the smell of stew has long since gone cold."
      : /market|bazaar/.test(place)
      ? "Cloth awnings snap overhead as traders shout across a crowded lane. Spices, damp canvas, and smoke compete in the warm air."
      : /forest|watchtower/.test(place)
      ? "The trees crowd the path, their branches shifting against an overcast sky. Somewhere past the undergrowth, a loose shutter strikes stone."
      : /crypt|monastery/.test(place)
      ? "Cold water seeps between the flagstones. Every footstep returns as a distant echo, and the air tastes of dust and old incense."
      : /village|mining/.test(place)
      ? "A few windows glow against the gathering dark. The streets are nearly empty, though the sound of hurried footsteps carries from somewhere nearby."
      : /estate|masquerade/.test(place)
      ? "Candlelight catches on polished floors and painted masks. Music drifts through open doors while servants quietly hurry between rooms."
      : /barge|floating/.test(place)
      ? "The boards shift beneath your feet as boats knock softly together. Lantern reflections break across black water between the narrow walkways."
      : "The air is thick with the sounds of people going about their business, but something has disturbed the usual rhythm of the place.";
    const introduction = `You reach ${place} ${when}. ${scenery}`;
    const situation = `${premise.charAt(0).toUpperCase() + premise.slice(1)}. Already, there are whispers that ${twist.charAt(0).toLowerCase() + twist.slice(1)}.`;
    const pressure = input.startInCombat
      ? "Before you can ask a question, a shout cuts through the air. Armed figures surge toward you, blocking the nearest escape. Where do you move first?"
      : "At the edge of the gathering, someone catches your eye and makes a quick, urgent gesture toward a side passage. A second figure notices, turns, and walks away. You have a moment to choose whom to follow.";
    return `${introduction} ${situation} The atmosphere is one of ${tone}, but the danger is immediate. ${pressure}`;
  }
  const combinedContext = `${input.title} ${input.guidance}`;
  const env = detectEnvironment(combinedContext);
  const isSocial = detectSocialIntent(combinedContext);
  const seed = input.title.trim() || "encounter";

  if (input.startInCombat) {
    const pool = COMBAT_OPENINGS[env] ?? COMBAT_OPENINGS.default;
    return pool[stableIndex(seed, pool.length)];
  }

  const pool = PEACEFUL_OPENINGS[env];
  const opening = pool[stableIndex(seed, pool.length)];

  const hook = isSocial
    ? " Words may matter here as much as anything else — how you open this exchange will set the terms of what follows."
    : " What you do next is the first sentence of how this goes.";

  return opening + hook;
}

export function buildAiDmOneOffFeedSeed(input: AiDmOneOffFeedSeedInput): AiDmOneOffFeedSeedResult {
  const guidanceSeed = buildAiDmOneOffGuidanceSeed({
    title: input.title,
    difficulty: input.difficulty,
    stylePreset: input.stylePreset,
    guidanceText: input.guidanceText,
  });

  const entries: AiDmSessionFeedEntry[] = [
    {
      id: createFeedEntryId("system-open"),
      role: "system",
      text: `Session ${input.sessionId} is now active for \"${input.title}\".`,
    },
    {
      id: createFeedEntryId("dm-opening"),
      role: "dm",
      text: buildOneOffOpeningBeat({
        title: input.title,
        startInCombat: input.startInCombat,
        guidance: guidanceSeed.guidance,
      }),
    },
    {
      id: createFeedEntryId("system-submode"),
      role: "system",
      text: input.startInCombat
        ? "Combat submode is primed as encounter-first entry."
        : "Story submode is primed for encounter setup and player intent.",
    },
  ];

  return {
    guidanceSource: guidanceSeed.source,
    entries,
  };
}

export function buildAiDmCampaignFeedSeed(input: AiDmCampaignFeedSeedInput): AiDmOneOffFeedSeedResult {
  const guidanceSeed = buildAiDmCampaignGuidanceSeed({
    campaignName: input.campaignName,
    chapterTitle: input.chapterTitle,
    difficulty: input.difficulty,
    stylePreset: input.stylePreset,
    guidanceText: input.guidanceText,
  });

  // Campaign mode starts with an empty feed — the DM opening turn fills it.
  return {
    guidanceSource: guidanceSeed.source,
    entries: [],
  };
}

export function buildAiDmPlayerInputReplyStub(input: {
  playerText: string;
  title: string;
  stylePreset: string;
  difficulty: string;
}): string {
  const trimmed = input.playerText.trim();
  return `Acknowledged: \"${trimmed}\". Continuing ${input.title} with a ${input.stylePreset} tone at ${input.difficulty} pressure.`;
}

export function buildAiDmQuickActionOutcome(action: AiDmQuickActionKey): { role: AiDmSessionFeedRole; text: string } {
  switch (action) {
    case "advance_scene":
      return { role: "tool", text: "Tool queued: advance scene beat and refresh immediate situation." };
    case "offer_choices":
      return { role: "tool", text: "Tool queued: generate three short player choices with clear tradeoffs." };
    case "start_combat":
      return { role: "tool", text: "Tool queued: prepare one-off combat submode handoff (bounded MVP path)." };
    case "resolve_turn":
      return { role: "tool", text: "Tool queued: resolve current beat and summarize immediate consequences." };
    case "loot_hook":
      return { role: "tool", text: "Tool queued: produce bounded encounter reward and loot handoff summary." };
    case "end_encounter":
      return { role: "system", text: "Encounter marked for closure in MVP session lifecycle." };
    default:
      return { role: "system", text: "Unsupported quick action." };
  }
}

export function buildQuickActionPlayerIntentText(action: AiDmQuickActionKey): string {
  switch (action) {
    case "advance_scene":
      return "Advance the scene beat.";
    case "offer_choices":
      return "Generate three short player choices.";
    case "resolve_turn":
      return "Resolve the current turn.";
    case "start_combat":
    case "loot_hook":
    case "end_encounter":
    default:
      return "";
  }
}
