/** Curated combinable one-off story prompts. Ten core premises × ten meaningful twists = 100 options per axis. */
export type OneOffSeedKind = "scenario" | "location" | "flavor";
const cores = {
  "scenario": [
    "A missing caravan returns with no passengers",
    "A village bell rings from a drowned chapel",
    "The magistrate hires you to investigate a vanished witness",
    "A courier dies delivering a letter addressed to you",
    "An old rival offers a reward for an impossible theft",
    "A festival champion disappears before the final contest",
    "A monster begs for sanctuary from its hunters",
    "A merchant sells an artifact that remembers its owners",
    "A local lord's double arrives claiming the throne",
    "A prison transport arrives with an empty locked carriage"
  ],
  "location": [
    "A mist-covered mountain village",
    "An abandoned lighthouse on a jagged coast",
    "A crowded bazaar in a desert city",
    "A ruined watchtower at the forest edge",
    "A subterranean dwarven market",
    "A snowbound roadside inn",
    "A floating market of lashed-together barges",
    "A flooded crypt beneath a monastery",
    "A noble estate during a masquerade",
    "A remote mining settlement"
  ],
  "flavor": [
    "Gothic dread",
    "Swashbuckling adventure",
    "Courtly intrigue",
    "Folkloric mystery",
    "Survival horror",
    "Whimsical fairy tale",
    "Dark fantasy",
    "High-stakes heist",
    "Political conspiracy",
    "Ancient cosmic mystery"
  ]
} as const;
const variations = {
  "scenario": [
    "A trusted ally may be involved",
    "The reward comes with a dangerous condition",
    "The truth threatens a local tradition",
    "Someone wants the evidence destroyed",
    "An innocent person has been blamed",
    "Time is running out",
    "The apparent villain asks for help",
    "The clues contradict eyewitness accounts",
    "A rival group is already on the trail",
    "The first lead arrives unexpectedly"
  ],
  "location": [
    "at dawn",
    "during a violent storm",
    "on the eve of a festival",
    "under an unnatural eclipse",
    "after the roads have closed",
    "as supplies run low",
    "during a tense public gathering",
    "with armed patrols nearby",
    "when the local ruler is absent",
    "as a strange omen appears"
  ],
  "flavor": [
    "with morally difficult choices",
    "with an atmosphere of mounting suspicion",
    "with moments of unexpected warmth",
    "with clever social challenges",
    "with exploration and hidden passages",
    "with an emphasis on grounded consequences",
    "with uneasy alliances",
    "with escalating supernatural signs",
    "with opportunities for creative problem-solving",
    "with a ticking clock"
  ]
} as const;
export const ONE_OFF_SEEDS: Record<OneOffSeedKind, string[]> = Object.fromEntries(
  (["scenario", "location", "flavor"] as OneOffSeedKind[]).map(kind => [
    kind, cores[kind].flatMap(core => variations[kind].map(variation => `${core} — ${variation}`)),
  ])
) as Record<OneOffSeedKind, string[]>;
export interface OneOffSeedSelection { scenario: string; location: string; flavor: string }
export function resolveOneOffSeeds(input: Partial<OneOffSeedSelection>, random: () => number = Math.random): OneOffSeedSelection {
  function choose(kind: OneOffSeedKind) {
    const selected = input[kind]?.trim();
    if (selected && ONE_OFF_SEEDS[kind].includes(selected)) return selected;
    const pool = ONE_OFF_SEEDS[kind];
    return pool[Math.min(pool.length - 1, Math.max(0, Math.floor(random() * pool.length)))];
  }
  return { scenario: choose("scenario"), location: choose("location"), flavor: choose("flavor") };
}
export function buildSeedGuidance(seed: OneOffSeedSelection): string {
  return `Adventure seed. Scenario: ${seed.scenario}. Location: ${seed.location}. Flavor: ${seed.flavor}. Open in the middle of a concrete, playable situation with sensory details, an immediate decision, and a consequential hook. Do not repeat these labels or explain the setup to the player.`;
}
