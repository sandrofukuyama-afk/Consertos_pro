import { GenCadParserError, isGenCadBoardview, parseGenCadBoardview } from "@/lib/boardview/gencad";
import { isTeboAscBoardview, parseTeboAscBoardview, TeboAscParserError } from "@/lib/boardview/tebo-asc";
import {
  LandrexBoardviewParserError,
  parseLandrexTestlinkBoardview,
} from "@/lib/boardview/landrex-testlink";
import type { ParsedBoardview } from "@/types/boardview";

export { GenCadParserError, LandrexBoardviewParserError, TeboAscParserError };

/**
 * Detects the boardview text format (GenCAD 1.4 or Landrex/Testlink
 * encoded .brd) and parses it into the shared ParsedBoardview shape.
 * Content is sniffed rather than relying on the file extension, since
 * both formats commonly travel under loosely-named extensions
 * (.cad, .brd, .bdv) depending on which tool exported them.
 */
export function parseBoardviewFile(bytes: Uint8Array | ArrayBuffer): ParsedBoardview {
  const input = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);

  if (isGenCadBoardview(input)) {
    return parseGenCadBoardview(input);
  }

  if (isTeboAscBoardview(input)) {
    return parseTeboAscBoardview(input);
  }

  return parseLandrexTestlinkBoardview(input);
}
