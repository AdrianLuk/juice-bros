/**
 * The real sheet's 24 rows as a paste (header included), shaped as the sheet
 * hands them over: tab-separated, Total Avg Rating counting a blank as 0.
 * Test data for the parser's unit tests and the roster e2e. Names other than
 * the four Captains, Ed Ju, Shaun L and the Wildcard are stand-ins.
 */

const rows: string[][] = [
  ["Adrian Luk", "M", "4.512", "4.5", "4.0", "4.337", "Adrian Luk"],
  ["Ava Moreno", "F", "3.884", "4.0", "3.5", "3.795", "Adrian Luk"],
  ["Ben Ortiz", "M", "4.201", "4.0", "4.5", "4.234", "Adrian Luk"],
  ["Cleo Park", "F", "3.402", "3.5", "3.0", "3.301", "Adrian Luk"],
  ["Ed Ju", "M", "4.258", "", "", "1.419", "Adrian Luk"],
  ["Wildcard (Kevin Ah-Chuen)", "M", "", "", "", "2.970", "Adrian Luk"],
  ["Chris Holden", "M", "4.877", "5.0", "4.5", "4.792", "Chris Holden"],
  ["Dana Wu", "F", "3.611", "3.5", "3.5", "3.537", "Chris Holden"],
  ["Eli Banks", "M", "4.043", "4.0", "4.0", "4.014", "Chris Holden"],
  ["Fay Lin", "F", "3.150", "3.0", "3.5", "3.217", "Chris Holden"],
  ["Gus Hale", "M", "5.056", "5.5", "5.0", "5.185", "Chris Holden"],
  ["Hana Ito", "M", "3.320", "3.5", "3.0", "3.273", "Chris Holden"],
  ["Daven Wong", "M", "4.405", "4.5", "4.5", "4.468", "Daven Wong"],
  ["Ivy Cho", "F", "3.744", "3.5", "4.0", "3.748", "Daven Wong"],
  ["Jon Reyes", "M", "3.906", "4.0", "3.5", "3.802", "Daven Wong"],
  ["Kim Doyle", "F", "3.003", "3.0", "3.0", "3.001", "Daven Wong"],
  ["Leo Marsh", "M", "4.690", "4.5", "5.0", "4.730", "Daven Wong"],
  ["Shaun L", "M", "3.775", "2.0", "1.5", "1.167", "Daven Wong"],
  ["Paul Richardson", "M", "4.120", "4.0", "4.0", "4.040", "Paul Richardson"],
  ["Mia Sato", "F", "3.560", "3.5", "3.5", "3.520", "Paul Richardson"],
  ["Nate Pruitt", "M", "4.333", "4.5", "4.0", "4.278", "Paul Richardson"],
  ["Opal Ray", "F", "3.218", "3.0", "3.5", "3.239", "Paul Richardson"],
  ["Quinn Tate", "M", "4.044", "4.0", "4.0", "4.015", "Paul Richardson"],
  ["Rosa Vega", "F", "3.701", "3.5", "4.0", "3.734", "Paul Richardson"],
];

export const SHEET_HEADER = ["Player", "M/F", "DUPR", "DUAR", "DUSR", "Total Avg Rating", "Team"].join("\t");

export const SHEET_PASTE = [SHEET_HEADER, ...rows.map((row) => row.join("\t"))].join("\n");

export const SHEET_CAPTAINS = ["Adrian Luk", "Chris Holden", "Daven Wong", "Paul Richardson"];
