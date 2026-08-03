import t from "../utils/i18n";
import { TEAM, TEAM_CHAT_COLOR, type TeamId } from "./constants";

interface GoalEntry {
  scorerName: string | null;
  teamId: TeamId;
  ownGoal: boolean;
  minute: number;
}

export interface SummaryLine {
  message: string;
  color: number;
}

export interface MatchStats {
  reset(): void;
  recordBallTouch(playerId: number, teamId: TeamId): void;
  clearBallTouch(): void;
  trackPossessionTick(): void;
  recordGoal(scoringTeamId: TeamId, timeElapsedSeconds: number): void;
  buildSummary(): SummaryLine[];
}

export default function createMatchStats(
  playerName: (playerId: number) => string
): MatchStats {
  let lastTouch: { playerId: number; teamId: TeamId } | null = null;
  let redPossessionTicks = 0;
  let bluePossessionTicks = 0;
  let redScore = 0;
  let blueScore = 0;
  let goals: GoalEntry[] = [];

  function reset(): void {
    lastTouch = null;
    redPossessionTicks = 0;
    bluePossessionTicks = 0;
    redScore = 0;
    blueScore = 0;
    goals = [];
  }

  function recordBallTouch(playerId: number, teamId: TeamId): void {
    lastTouch = { playerId, teamId };
  }

  function clearBallTouch(): void {
    lastTouch = null;
  }

  function trackPossessionTick(): void {
    if (!lastTouch) {
      return;
    }
    if (lastTouch.teamId === TEAM.RED) {
      redPossessionTicks += 1;
    } else if (lastTouch.teamId === TEAM.BLUE) {
      bluePossessionTicks += 1;
    }
  }

  function recordGoal(
    scoringTeamId: TeamId,
    timeElapsedSeconds: number
  ): void {
    if (scoringTeamId === TEAM.RED) {
      redScore += 1;
    } else if (scoringTeamId === TEAM.BLUE) {
      blueScore += 1;
    }
    goals.push({
      scorerName: lastTouch ? playerName(lastTouch.playerId) : null,
      teamId: scoringTeamId,
      ownGoal: lastTouch != null && lastTouch.teamId !== scoringTeamId,
      minute: Math.max(1, Math.ceil(timeElapsedSeconds / 60)),
    });
  }

  function scorerList(teamId: TeamId): string {
    return goals
      .filter((goal) => goal.teamId === teamId)
      .map((goal) => {
        const name = goal.scorerName ?? t("match.summaryUnknownScorer");
        const ownGoalSuffix = goal.ownGoal
          ? ` ${t("match.summaryOwnGoal")}`
          : "";
        return `${name} ${goal.minute}'${ownGoalSuffix}`;
      })
      .join(", ");
  }

  function buildSummary(): SummaryLine[] {
    const lines: SummaryLine[] = [
      {
        message: t("match.summaryHeader", { redScore, blueScore }),
        color: 0xffcc00,
      },
    ];

    const redScorers = scorerList(TEAM.RED);
    if (redScorers) {
      lines.push({
        message: t("match.summaryScorersRed", { scorers: redScorers }),
        color: TEAM_CHAT_COLOR[TEAM.RED],
      });
    }

    const blueScorers = scorerList(TEAM.BLUE);
    if (blueScorers) {
      lines.push({
        message: t("match.summaryScorersBlue", { scorers: blueScorers }),
        color: TEAM_CHAT_COLOR[TEAM.BLUE],
      });
    }

    const totalTicks = redPossessionTicks + bluePossessionTicks;
    const redPercent =
      totalTicks > 0
        ? Math.round((redPossessionTicks / totalTicks) * 100)
        : 50;
    lines.push({
      message: t("match.summaryPossession", {
        red: redPercent,
        blue: 100 - redPercent,
      }),
      color: 0xffcc00,
    });

    return lines;
  }

  return {
    reset,
    recordBallTouch,
    clearBallTouch,
    trackPossessionTick,
    recordGoal,
    buildSummary,
  };
}
