/**
 * FedExCup Points Engine
 * Source: Wikipedia - List of point distributions of the FedEx Cup
 *         PGA TOUR FedExCup Overview (pgatour.com)
 */

export type EventCategory = "major" | "signature" | "full_field" | "additional" | "team_event" | "playoff_1" | "playoff_2";

// FedExCup points by finish position for each event category
// Based on official PGA TOUR FedExCup distribution tables
const POINTS_TABLE: Record<EventCategory, Record<number, number>> = {
  // Majors & PLAYERS Championship: 750 to winner
  major: {
    1: 750, 2: 500, 3: 350, 4: 325, 5: 300, 6: 270, 7: 250, 8: 225, 9: 200, 10: 175,
    11: 155, 12: 135, 13: 115, 14: 105, 15: 95, 16: 85, 17: 75, 18: 70, 19: 65, 20: 60,
    21: 55, 22: 53, 23: 51, 24: 49, 25: 47, 26: 45, 27: 43, 28: 41, 29: 39, 30: 37,
    31: 35, 32: 33, 33: 31, 34: 29, 35: 27, 36: 26, 37: 25, 38: 24, 39: 23, 40: 22,
    41: 21, 42: 20.25, 43: 19.5, 44: 18.75, 45: 18, 46: 17.25, 47: 16.5, 48: 15.75, 49: 15, 50: 14.25,
    51: 13.5, 52: 13, 53: 12.5, 54: 12, 55: 11.5, 56: 11, 57: 10.5, 58: 10, 59: 9.5, 60: 9,
    61: 8.5, 62: 8, 63: 7.5, 64: 7, 65: 6.5, 66: 6.25, 67: 6, 68: 5.75, 69: 5.5, 70: 5.25,
    71: 5, 72: 4.75, 73: 4.5, 74: 4.25, 75: 4,
  },
  // Signature Events: 700 to winner
  signature: {
    1: 700, 2: 400, 3: 350, 4: 325, 5: 300, 6: 275, 7: 225, 8: 200, 9: 175, 10: 150,
    11: 130, 12: 120, 13: 110, 14: 100, 15: 90, 16: 80, 17: 70, 18: 65, 19: 60, 20: 55,
    21: 50, 22: 48, 23: 46, 24: 44, 25: 42, 26: 40, 27: 38, 28: 36, 29: 34, 30: 32.5,
    31: 31, 32: 29.5, 33: 28, 34: 26.5, 35: 25, 36: 24, 37: 23, 38: 22, 39: 21, 40: 20.25,
    41: 19.5, 42: 18.75, 43: 18, 44: 17.25, 45: 16.5, 46: 15.75, 47: 15, 48: 14.25, 49: 13.5, 50: 13,
    51: 12.5, 52: 12, 53: 11.5, 54: 11, 55: 10.5, 56: 10, 57: 9.5, 58: 9, 59: 8.5, 60: 8.25,
    61: 8, 62: 7.75, 63: 7.5, 64: 7.25, 65: 7, 66: 6.75, 67: 6.5, 68: 6.25, 69: 6, 70: 5.75,
    71: 5.5, 72: 5.25, 73: 5, 74: 4.75, 75: 4.5,
  },
  // Full Field Events: 500 to winner
  full_field: {
    1: 500, 2: 300, 3: 190, 4: 135, 5: 110, 6: 100, 7: 90, 8: 85, 9: 80, 10: 75,
    11: 70, 12: 65, 13: 60, 14: 57, 15: 55, 16: 53, 17: 51, 18: 49, 19: 47, 20: 45,
    21: 43, 22: 41, 23: 39, 24: 37, 25: 35.5, 26: 34, 27: 32.5, 28: 31, 29: 29.5, 30: 28,
    31: 26.5, 32: 25, 33: 23.5, 34: 22, 35: 21, 36: 20, 37: 19, 38: 18, 39: 17, 40: 16,
    41: 15, 42: 14, 43: 13, 44: 12, 45: 11, 46: 10.5, 47: 10, 48: 9.5, 49: 9, 50: 8.5,
    51: 8, 52: 7.5, 53: 7, 54: 6.5, 55: 6, 56: 5.8, 57: 5.6, 58: 5.4, 59: 5.2, 60: 5,
    61: 4.8, 62: 4.6, 63: 4.4, 64: 4.2, 65: 4, 66: 3.9, 67: 3.8, 68: 3.7, 69: 3.6, 70: 3.5,
    71: 3.4, 72: 3.3, 73: 3.2, 74: 3.1, 75: 3, 76: 2.9, 77: 2.8, 78: 2.7, 79: 2.6, 80: 2.5,
  },
  // Additional Events: 300 to winner
  additional: {
    1: 300, 2: 165, 3: 105, 4: 80, 5: 65, 6: 60, 7: 55, 8: 50, 9: 45, 10: 40,
    11: 37.5, 12: 35, 13: 32.5, 14: 31, 15: 30.5, 16: 30, 17: 29.5, 18: 29, 19: 28.5, 20: 28,
    21: 26.76, 22: 25.51, 23: 24.27, 24: 23.02, 25: 22.09, 26: 21.16, 27: 20.22, 28: 19.29, 29: 18.36, 30: 17.42,
    31: 16.49, 32: 15.56, 33: 14.62, 34: 13.69, 35: 13.07, 36: 12.44, 37: 11.82, 38: 11.2, 39: 10.58, 40: 9.96,
    41: 9.33, 42: 8.71, 43: 8.09, 44: 7.47, 45: 6.84, 46: 6.53, 47: 6.22, 48: 5.91, 49: 5.6, 50: 5.29,
    51: 4.98, 52: 4.67, 53: 4.36, 54: 4.04, 55: 3.73, 56: 3.61, 57: 3.48, 58: 3.36, 59: 3.24, 60: 3.11,
  },
  // Zurich Classic team event: 400 points per player on winning team
  team_event: {
    1: 400, 2: 230, 3: 145, 4: 100, 5: 80, 6: 70, 7: 65, 8: 60, 9: 55, 10: 50,
    11: 47, 12: 44, 13: 41, 14: 38, 15: 36, 16: 34, 17: 32, 18: 30, 19: 28, 20: 26,
  },
  // FedEx St. Jude / BMW Championship playoffs: 2000 to winner (4x multiplier)
  playoff_1: {
    1: 2000, 2: 1200, 3: 760, 4: 540, 5: 440, 6: 400, 7: 360, 8: 340, 9: 320, 10: 300,
    11: 280, 12: 260, 13: 240, 14: 228, 15: 220, 16: 212, 17: 204, 18: 196, 19: 188, 20: 180,
    21: 172, 22: 164, 23: 156, 24: 148, 25: 142, 26: 136, 27: 130, 28: 124, 29: 118, 30: 112,
    31: 106, 32: 100, 33: 94, 34: 88, 35: 84, 36: 80, 37: 76, 38: 72, 39: 68, 40: 64,
    41: 60, 42: 56, 43: 52, 44: 48, 45: 44, 46: 42, 47: 40, 48: 38, 49: 36, 50: 34,
    51: 32, 52: 30, 53: 28, 54: 26, 55: 24, 56: 23.2, 57: 22.4, 58: 21.6, 59: 20.8, 60: 20,
    61: 19.2, 62: 18.4, 63: 17.6, 64: 16.8, 65: 16, 66: 15.2, 67: 14.4, 68: 13.6, 69: 12.8, 70: 12,
  },
  // Tour Championship (separate scoring structure – same as playoff_1 for points purposes)
  playoff_2: {
    1: 2000, 2: 1200, 3: 760, 4: 540, 5: 440, 6: 400, 7: 360, 8: 340, 9: 320, 10: 300,
    11: 280, 12: 260, 13: 240, 14: 228, 15: 220, 16: 212, 17: 204, 18: 196, 19: 188, 20: 180,
    21: 172, 22: 164, 23: 156, 24: 148, 25: 142, 26: 136, 27: 130, 28: 124, 29: 118, 30: 112,
  },
};

export function pointsForPosition(category: EventCategory, position: number): number {
  const table = POINTS_TABLE[category];
  if (!table) return 0;
  // Exact match
  if (table[position] !== undefined) return table[position];
  // Interpolate for positions beyond the table
  const maxPos = Math.max(...Object.keys(table).map(Number));
  if (position > maxPos) return 0;
  return 0;
}

// Classify event by name keywords
const MAJOR_KEYWORDS = ["masters", "us open", "u.s. open", "open championship", "the open", "pga championship"];
const SIGNATURE_KEYWORDS = ["players championship", "genesis invitational", "arnold palmer", "memorial tournament", "travelers", "rbc canadian", "scottish open", "john deere", "3m open", "bmw", "fedex st. jude"];
const PLAYOFF_KEYWORDS = ["fedex st. jude championship", "bmw championship", "tour championship"];
const ADDITIONAL_KEYWORDS = ["opposite", "korn ferry", "barracuda", "barbasol", "emerald coast", "3m open", "genesis scottish"];

export function classifyEvent(name: string): EventCategory {
  const lower = name.toLowerCase();
  if (PLAYOFF_KEYWORDS.some(k => lower.includes(k))) {
    if (lower.includes("tour championship")) return "playoff_2";
    return "playoff_1";
  }
  if (MAJOR_KEYWORDS.some(k => lower.includes(k))) return "major";
  if (lower.includes("zurich")) return "team_event";
  if (SIGNATURE_KEYWORDS.some(k => lower.includes(k))) return "signature";
  if (ADDITIONAL_KEYWORDS.some(k => lower.includes(k))) return "additional";
  return "full_field";
}

export function isMajor(name: string): boolean {
  const lower = name.toLowerCase();
  return MAJOR_KEYWORDS.some(k => lower.includes(k));
}

// Compute manager standings from player season totals
export interface ManagerStanding {
  managerId: string;
  managerName: string;
  rank: number;
  top3Points: number;
  allPoints: number;
  players: PlayerRow[];
}

export interface PlayerRow {
  name: string;
  fedexPoints: number;
  fedexRank: number | null;
  isTop3: boolean;
}

export function computeStandings(
  mgrs: { id: string; name: string }[],
  rosterRows: { managerId: string; playerName: string }[],
  totalsMap: Map<string, { fedexPoints: number; fedexRank: number | null }>
): ManagerStanding[] {
  const standings: ManagerStanding[] = mgrs.map(m => {
    const playerNames = rosterRows.filter(r => r.managerId === m.id).map(r => r.playerName);
    const players: PlayerRow[] = playerNames.map(name => {
      const t = totalsMap.get(name) ?? { fedexPoints: 0, fedexRank: null };
      return { name, fedexPoints: t.fedexPoints, fedexRank: t.fedexRank, isTop3: false };
    });
    // Sort descending
    players.sort((a, b) => b.fedexPoints - a.fedexPoints);
    // Mark top 3
    players.slice(0, 3).forEach(p => p.isTop3 = true);
    const top3Points = players.slice(0, 3).reduce((s, p) => s + p.fedexPoints, 0);
    const allPoints = players.reduce((s, p) => s + p.fedexPoints, 0);
    return { managerId: m.id, managerName: m.name, rank: 0, top3Points, allPoints, players };
  });
  // Rank
  standings.sort((a, b) => b.top3Points - a.top3Points);
  standings.forEach((s, i) => s.rank = i + 1);
  return standings;
}
