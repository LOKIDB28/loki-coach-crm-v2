import { test, expect } from "@playwright/test";
import { findClientMatches } from "../src/lib/domain";
import { formatPhone, phoneDigits, phoneForCsv, phoneMatchesQuery } from "../src/lib/phone";

// Pure data-in, string-out checks on lib/phone.ts (and the duplicate rule in
// lib/domain.ts that uses it) - no page, no Supabase,
// fictitious numbers only.

const CASES: [input: string, expected: string][] = [
  // North American shapes → +1-AAA-BBB-CCCC
  ["(418) 805-5602", "+1-418-805-5602"],
  ["418.805.5602", "+1-418-805-5602"],
  ["1-418-805-5602", "+1-418-805-5602"],
  ["+1 418 805 5602", "+1-418-805-5602"],
  ["4188055602", "+1-418-805-5602"],
  ["+14188055602", "+1-418-805-5602"],
  ["+1 (418) 805-5602", "+1-418-805-5602"],
  ["  418 805 5602  ", "+1-418-805-5602"],
  ["+1-418-805-5602", "+1-418-805-5602"],
  // Extensions kept
  ["418-805-5602 x123", "+1-418-805-5602 x123"],
  ["418-805-5602 X 123", "+1-418-805-5602 x123"],
  ["418 805 5602 ext. 45", "+1-418-805-5602 x45"],
  ["418 805 5602 poste 7", "+1-418-805-5602 x7"],
  ["4188055602#9", "+1-418-805-5602 x9"],
  // Other country codes: kept as typed, no North American split
  ["+52 55 1234 5678", "+52 55 1234 5678"],
  ["+33 1 23 45 67 89", "+33 1 23 45 67 89"],
  ["+4188055602", "+4188055602"],
  // Unknown shapes: kept as typed
  ["805-5602", "805-5602"],
  ["418 805 560", "418 805 560"],
  ["41880556021", "41880556021"],
  ["011 52 55 1234 5678", "011 52 55 1234 5678"],
  ["418-805-5602 / 418-555-1234", "418-805-5602 / 418-555-1234"],
  ["Cell 418-805-5602", "Cell 418-805-5602"],
  ["+1 800 FLOWERS", "+1 800 FLOWERS"],
  ["x123", "x123"],
  ["", ""],
];

test("formatPhone : tableau entrée → sortie", () => {
  for (const [input, expected] of CASES) expect(formatPhone(input), input).toBe(expected);
});

test("formatPhone : aucun chiffre perdu, idempotent", () => {
  for (const [input] of CASES) {
    const out = formatPhone(input);
    const inDigits = phoneDigits(input);
    // Only ever adds the "1" country code in front - never drops or reorders a digit.
    expect([inDigits, "1" + inDigits], input).toContain(phoneDigits(out));
    expect(formatPhone(out), input).toBe(out);
  }
});

// Same predicate as the dashboard's search (page.tsx: plain text match OR
// phoneMatchesQuery), on one fictitious client stored in several formats.
const searchHits = (stored: string, query: string) => {
  const q = query.trim().toLowerCase();
  return stored.toLowerCase().includes(q) || phoneMatchesQuery(stored, q);
};

test("recherche : « 418 805 », « 4188055602 » et « +1-418-805 » trouvent le même client, quel que soit le format enregistré", () => {
  for (const stored of ["(418) 805-5602", "418.805.5602", "4188055602", "+1-418-805-5602", "1-418-805-5602 poste 12"]) {
    for (const query of ["418 805", "4188055602", "+1-418-805"]) {
      expect(searchHits(stored, query), `${stored} ← ${query}`).toBe(true);
    }
  }
  // Never broader than intended: not phone-like, or too few digits.
  expect(phoneMatchesQuery("(418) 805-5602", "Lévesque 418")).toBe(false);
  expect(phoneMatchesQuery("(418) 805-5602", "41")).toBe(false);
  expect(phoneMatchesQuery("(418) 805-5602", "514 555")).toBe(false);
  expect(phoneMatchesQuery(null, "418 805")).toBe(false);
});

test("doublons : numéro principal (« 1 » retiré) et extension comparés séparément", () => {
  const PAIRS: [a: string, b: string, isDupe: boolean][] = [
    ["(418) 805-5602", "+1 418 805 5602", true],
    ["(418) 805-5602", "+1-418-805-5602", true],
    ["418-805-5602 x123", "+1-418-805-5602 x123", true], // was "—" before this rule
    ["418-805-5602 x123", "1-418-805-5602 poste 123", true], // was "—" before this rule
    ["418-805-5602 x123", "418-805-5602 x456", false], // same switchboard, two people
    ["418-805-5602", "418-805-5602 x123", false],
    ["+52 55 1234 5678", "52 55 1234 5678", true],
    ["805-5602", "418-805-5602", false],
  ];
  for (const [a, b, isDupe] of PAIRS) {
    const matches = findClientMatches({ id: "a", prenom: "Client", nom: "Fictif A", telephone: a }, [
      { id: "b", prenom: "Client", nom: "Fictif B", telephone: b },
    ]);
    expect(matches.length === 1, `${a} / ${b}`).toBe(isDupe);
  }
});

test("export CSV : téléphone formaté, jamais interprété comme une formule, aucun caractère perdu", () => {
  expect(phoneForCsv("(418) 805-5602")).toBe("'+1-418-805-5602");
  expect(phoneForCsv("418-805-5602 poste 7")).toBe("'+1-418-805-5602 x7");
  expect(phoneForCsv("+52 55 1234 5678")).toBe("'+52 55 1234 5678");
  expect(phoneForCsv("=1+1")).toBe("'=1+1");
  expect(phoneForCsv("@SUM(A1)")).toBe("'@SUM(A1)");
  expect(phoneForCsv("-5602")).toBe("'-5602");
  expect(phoneForCsv("805-5602")).toBe("805-5602");
  expect(phoneForCsv(null)).toBe("");
});
