/* 药理闯关 · 乐谱：茉莉花 */
import { PG, reg } from "../../core/registry.js";
import { F_CHORDS, harmonize, parseScore } from "../compose.js";

reg({ SCORE_MOLIHUA: () => SCORE_MOLIHUA, MOLI_HARM: () => MOLI_HARM, MOLI_BARS: () => MOLI_BARS });

// 茉莉花：江苏民歌，1=F，4/4，中速 72。依据苍强曲谱的简谱图与智能谱核对（第一句唱两遍）
export const SCORE_MOLIHUA = "69:1 69:0.5 72:0.5 74:0.5 77:0.5 77:0.5 74:0.5 72:1 72:0.5 74:0.5 72:2 " +
  "69:1 69:0.5 72:0.5 74:0.5 77:0.5 77:0.5 74:0.5 72:1 72:0.5 74:0.5 72:2 " +
  "72:1 72:1 72:1 69:0.5 72:0.5 74:1 74:1 72:2 " +
  "69:1 67:0.5 69:0.5 72:1 69:0.5 67:0.5 65:1 65:0.5 67:0.5 65:2 " +
  "69:0.5 67:0.5 65:0.5 69:0.5 67:1.5 69:0.5 72:1 74:0.5 77:0.5 72:2 " +
  "67:1 69:0.5 72:0.5 67:0.5 69:0.5 65:0.5 62:0.5 60:2 62:1 65:1 " +
  "67:1.5 69:0.5 65:0.5 67:0.5 65:0.5 62:0.5 60:4";
export const MOLI_HARM = harmonize(parseScore(SCORE_MOLIHUA), F_CHORDS);
export const MOLI_BARS = Math.ceil(parseScore(SCORE_MOLIHUA).reduce((a, x) => a + x[1], 0) / 4);
