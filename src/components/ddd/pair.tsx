import { forecast } from "@/lib/ddd/matchups";

/** A Court turn's band in a pairing: "Played 1st". A Lineup that can't split plays up to four. */
export function TurnBand({ turn }: { turn: number }) {
  return <p className="ddd-turn-band">Played {["1st", "2nd", "3rd", "4th"][turn]}</p>;
}

/**
 * A Pair one player per line, so a long name never drags its partner onto a
 * ragged line. Still reads "Ben Johns / Ben Ortiz" to a screen reader.
 */
export function PairNames({ names }: { names: string[] }) {
  return (
    <span className="ddd-pair-names">
      {names.map((name, index) => (
        <span key={index}>
          {index > 0 ? <span className="ddd-sr"> / </span> : null}
          {name}
        </span>
      ))}
    </span>
  );
}

export function Underdog() {
  return <span className="ddd-underdog">Underdog</span>;
}

/** The Forecast on one line, under a Pair in a Matchup: "Forecast 5.5 · Goal: Score 6+". */
export function ForecastLine({ lower, spread }: { lower: boolean; spread: number }) {
  const { points, target } = forecast(lower, spread);
  return (
    <span className="ddd-forecast">
      Forecast <b>{points}</b> · Goal: <b>{target}</b>
      {lower ? <Underdog /> : null}
    </span>
  );
}
