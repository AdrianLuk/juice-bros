import { ImageResponse } from "next/og";

/**
 * Team Tally's share card, used by the Score Links and the Public Link the
 * Brief prints (see layout.tsx). The broadcast package in one frame: the mark
 * on gym white and a navy score bug (team-tally/DESIGN.md). Rendered once at
 * build time.
 */

export const alt = "Team Tally: live scores for captained pickleball team nights";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const INK = "#1a2233";
const INK_DIM = "#5b6578";
const GROUND = "#f2f4f8";
const PLATE = "#0f1b30";
const PLATE_RAISED = "#18284a";
const PLATE_BAR = "#0a1324";
const PLATE_LINE = "#1d2c48";
const PLATE_DIM = "#9fb0c9";
const RED = "#e2322c";
const BLUE = "#1d5ae0";
const NOW = "#d8f03a";

/** A Google font as TTF: the CSS API serves TTF to a client it doesn't recognise as a browser. */
async function googleFont(family: string, weight: number): Promise<ArrayBuffer> {
  const css = await (
    await fetch(`https://fonts.googleapis.com/css2?family=${family.replaceAll(" ", "+")}:wght@${weight}`)
  ).text();
  const url = css.match(/src: url\((.+?)\) format\('(?:opentype|truetype)'\)/)?.[1];
  if (!url) throw new Error(`No TTF for ${family} ${weight}`);
  return (await fetch(url)).arrayBuffer();
}

const ROWS = [
  { name: "TEAM BEN", stripe: RED, rounds: [21, 19, 22], total: 62 },
  { name: "TEAM ANNA", stripe: BLUE, rounds: [18, 22, 20], total: 60 },
];

export default async function Image() {
  const [cond, sans] = await Promise.all([
    googleFont("Sofia Sans Extra Condensed", 800),
    googleFont("Sofia Sans", 500),
  ]);

  const cell = { width: 92, display: "flex", justifyContent: "center" } as const;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          background: GROUND,
          color: INK,
          fontFamily: "Sofia Sans",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
            <div style={{ display: "flex", gap: 8, height: 96 }}>
              <div style={{ width: 38, background: RED, borderRadius: 4 }} />
              <div style={{ width: 38, background: BLUE, borderRadius: 4 }} />
            </div>
            <div
              style={{ fontFamily: "Sofia Sans Extra Condensed", fontSize: 132, letterSpacing: 4, lineHeight: 1 }}
            >
              TEAM TALLY
            </div>
          </div>
          <div style={{ fontSize: 36, color: INK_DIM }}>Live scores and standings for team night.</div>
        </div>

        <div style={{ display: "flex" }}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              background: PLATE,
              color: "#ffffff",
              fontFamily: "Sofia Sans Extra Condensed",
              borderRadius: 6,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                padding: "12px 0 12px 24px",
                background: PLATE_BAR,
                color: PLATE_DIM,
                fontSize: 26,
                letterSpacing: 3,
              }}
            >
              <div style={{ width: 14, height: 14, borderRadius: 7, background: NOW }} />
              <div style={{ display: "flex", flexGrow: 1, width: 300 }}>MATCH 1 · COURTS 7 &amp; 10</div>
              <div style={cell}>R1</div>
              <div style={cell}>R2</div>
              <div style={{ ...cell, color: NOW }}>R3</div>
              <div style={cell}>TOT</div>
            </div>
            {ROWS.map((row, index) => (
              <div
                key={row.name}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  fontSize: 44,
                  borderTop: index ? `2px solid ${PLATE_LINE}` : "none",
                }}
              >
                <div style={{ width: 10, height: 72, background: row.stripe }} />
                <div style={{ display: "flex", width: 328, letterSpacing: 2 }}>{row.name}</div>
                {row.rounds.map((points, round) => (
                  <div key={round} style={{ ...cell, color: PLATE_DIM }}>
                    {points}
                  </div>
                ))}
                <div style={{ ...cell, height: 72, alignItems: "center", background: PLATE_RAISED }}>{row.total}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Sofia Sans Extra Condensed", data: cond, weight: 800 },
        { name: "Sofia Sans", data: sans, weight: 500 },
      ],
    },
  );
}
