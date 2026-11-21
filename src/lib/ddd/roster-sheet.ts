/**
 * The real sheet's 24 rows as a paste (header included), shaped as the sheet
 * hands them over: tab-separated, Total Avg Rating counting a blank as 0.
 * Test data for the parser's unit tests and the roster e2e. Names other than
 * the four Captains, Ed Ju, Riley Newman and the Wildcard are stand-ins.
 */

const rows: string[][] = [
  ["Ben Johns", "M", "4.512", "4.5", "4.0", "4.337", "Ben Johns"],
  ["Ava Moreno", "F", "3.884", "4.0", "3.5", "3.795", "Ben Johns"],
  ["Ben Ortiz", "M", "4.201", "4.0", "4.5", "4.234", "Ben Johns"],
  ["Cleo Park", "F", "3.402", "3.5", "3.0", "3.301", "Ben Johns"],
  ["Ed Ju", "M", "4.258", "", "", "1.419", "Ben Johns"],
  ["Wildcard (Kevin Ah-Chuen)", "M", "", "", "", "2.970", "Ben Johns"],
  ["Anna Leigh Waters", "F", "4.877", "5.0", "4.5", "4.792", "Anna Leigh Waters"],
  ["Dana Wu", "F", "3.611", "3.5", "3.5", "3.537", "Anna Leigh Waters"],
  ["Eli Banks", "M", "4.043", "4.0", "4.0", "4.014", "Anna Leigh Waters"],
  ["Fay Lin", "F", "3.150", "3.0", "3.5", "3.217", "Anna Leigh Waters"],
  ["Gus Hale", "M", "5.056", "5.5", "5.0", "5.185", "Anna Leigh Waters"],
  ["Hana Ito", "M", "3.320", "3.5", "3.0", "3.273", "Anna Leigh Waters"],
  ["Tyson McGuffin", "M", "4.405", "4.5", "4.5", "4.468", "Tyson McGuffin"],
  ["Ivy Cho", "F", "3.744", "3.5", "4.0", "3.748", "Tyson McGuffin"],
  ["Jon Reyes", "M", "3.906", "4.0", "3.5", "3.802", "Tyson McGuffin"],
  ["Kim Doyle", "F", "3.003", "3.0", "3.0", "3.001", "Tyson McGuffin"],
  ["Leo Marsh", "M", "4.690", "4.5", "5.0", "4.730", "Tyson McGuffin"],
  ["Riley Newman", "M", "3.775", "2.0", "1.5", "1.167", "Tyson McGuffin"],
  ["Federico Staksrud", "M", "4.120", "4.0", "4.0", "4.040", "Federico Staksrud"],
  ["Mia Sato", "F", "3.560", "3.5", "3.5", "3.520", "Federico Staksrud"],
  ["Nate Pruitt", "M", "4.333", "4.5", "4.0", "4.278", "Federico Staksrud"],
  ["Opal Ray", "F", "3.218", "3.0", "3.5", "3.239", "Federico Staksrud"],
  ["Quinn Tate", "M", "4.044", "4.0", "4.0", "4.015", "Federico Staksrud"],
  ["Rosa Vega", "F", "3.701", "3.5", "4.0", "3.734", "Federico Staksrud"],
];

export const SHEET_HEADER = ["Player", "M/F", "DUPR", "DUAR", "DUSR", "Total Avg Rating", "Team"].join("\t");

export const SHEET_PASTE = [SHEET_HEADER, ...rows.map((row) => row.join("\t"))].join("\n");

export const SHEET_CAPTAINS = ["Ben Johns", "Anna Leigh Waters", "Tyson McGuffin", "Federico Staksrud"];
