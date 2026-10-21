import type { Open5eFeat, Open5eBackground, Open5eCondition, Open5eMonster } from '../types/index';

const BASE_URL = 'https://api.open5e.com/v1';
const MONSTER_PAGE_LIMIT = 500;
const MONSTER_FETCH_PARALLELISM = 4;

export async function fetchOpen5eFeats(): Promise<Open5eFeat[]> {
  const feats: Open5eFeat[] = [];
  let url = `${BASE_URL}/feats/?format=json`;
  while (url) {
    const res = await fetch(url);
    const data = await res.json();
    feats.push(...data.results);
    url = data.next;
  }
  return feats;
}

export async function fetchOpen5eBackgrounds(): Promise<Open5eBackground[]> {
  const backgrounds: Open5eBackground[] = [];
  let url = `${BASE_URL}/backgrounds/?format=json`;
  while (url) {
    const res = await fetch(url);
    const data = await res.json();
    backgrounds.push(...data.results);
    url = data.next;
  }
  return backgrounds;
}

export async function fetchOpen5eConditions(): Promise<Open5eCondition[]> {
  const conditions: Open5eCondition[] = [];
  let url = `${BASE_URL}/conditions/?format=json`;
  while (url) {
    const res = await fetch(url);
    const data = await res.json();
    conditions.push(...data.results);
    url = data.next;
  }
  return conditions;
}

export async function fetchOpen5eMonsters(): Promise<Open5eMonster[]> {
  const initialUrl = `${BASE_URL}/monsters/?format=json&limit=${MONSTER_PAGE_LIMIT}`;
  const firstRes = await fetch(initialUrl);
  if (!firstRes.ok) {
    throw new Error(`Open5e monsters request failed: ${firstRes.status}`);
  }

  const firstPage = await firstRes.json();
  const monsters: Open5eMonster[] = [...(firstPage.results ?? [])];
  const totalCount = Number(firstPage.count ?? 0);

  // Fetch remaining pages in parallel when count metadata is available.
  if (Number.isFinite(totalCount) && totalCount > monsters.length) {
    const pageCount = Math.ceil(totalCount / MONSTER_PAGE_LIMIT);
    const pageUrls: string[] = [];
    for (let pageIndex = 1; pageIndex < pageCount; pageIndex += 1) {
      pageUrls.push(`${BASE_URL}/monsters/?format=json&limit=${MONSTER_PAGE_LIMIT}&offset=${pageIndex * MONSTER_PAGE_LIMIT}`);
    }

    for (let index = 0; index < pageUrls.length; index += MONSTER_FETCH_PARALLELISM) {
      const batchUrls = pageUrls.slice(index, index + MONSTER_FETCH_PARALLELISM);
      const pageResults = await Promise.all(
        batchUrls.map(async (url) => {
          const res = await fetch(url);
          if (!res.ok) {
            throw new Error(`Open5e monsters request failed: ${res.status}`);
          }
          const data = await res.json();
          return (data.results ?? []) as Open5eMonster[];
        })
      );

      for (const page of pageResults) {
        monsters.push(...page);
      }
    }

    return monsters;
  }

  // Fallback path for APIs without count metadata.
  let nextUrl: string | null = firstPage.next ?? null;
  while (nextUrl) {
    const res = await fetch(nextUrl);
    if (!res.ok) {
      throw new Error(`Open5e monsters request failed: ${res.status}`);
    }
    const data = await res.json();
    monsters.push(...(data.results ?? []));
    nextUrl = data.next ?? null;
  }

  return monsters;
}
