export type BoardviewMountingSide = "top" | "bottom" | "both";

export type BoardviewPartKind = "smd" | "through_hole";

export type BoardviewVariant =
  | "encoded-landrex-testlink"
  | "plain-text-or-unknown-variant";

export type BoardviewPoint = {
  xMil: number;
  yMil: number;
  xMm: number;
  yMm: number;
};

export type BoardviewBounds = {
  minXMil: number;
  maxXMil: number;
  minYMil: number;
  maxYMil: number;
  minXMm: number;
  maxXMm: number;
  minYMm: number;
  maxYMm: number;
};

export type BoardviewCounts = {
  contourPoints: number;
  components: number;
  padPins: number;
  testPoints: number;
  nets: number;
};

export type BoardviewMetadata = {
  format: "landrex-testlink";
  variant: BoardviewVariant;
  sourceEncoding: "latin1";
  declaredCounts: BoardviewCounts;
  parsedCounts: BoardviewCounts;
  bounds: BoardviewBounds;
  boardWidthMil: number;
  boardHeightMil: number;
  boardWidthMm: number;
  boardHeightMm: number;
};

export type BoardviewComponent = {
  ref: string;
  partIndex: number;
  rawType: number;
  mountingSide: BoardviewMountingSide;
  kind: BoardviewPartKind;
  firstPinIndex: number;
  lastPinIndex: number;
  pinCount: number;
};

export type BoardviewPadPin = BoardviewPoint & {
  id: string;
  partIndex: number;
  partRef: string;
  pinOrdinalWithinPart: number;
  probe: number;
  netName: string;
  side: BoardviewMountingSide;
};

export type BoardviewNet = {
  name: string;
  padPinCount: number;
  testPointCount: number;
  probeIds: number[];
};

export type BoardviewTestPoint = BoardviewPoint & {
  id: string;
  probe: number;
  side: BoardviewMountingSide;
  netName: string;
};

export type ParsedBoardview = {
  metadata: BoardviewMetadata;
  contour: BoardviewPoint[];
  components: BoardviewComponent[];
  padPins: BoardviewPadPin[];
  nets: BoardviewNet[];
  testPoints: BoardviewTestPoint[];
};
