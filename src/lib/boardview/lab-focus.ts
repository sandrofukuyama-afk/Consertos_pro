import {
  type BoardviewLabModel,
  type BoardviewLabSelection,
  type BoardviewLabSideFilter,
  searchBoardviewLabModel,
} from "./lab";

export type InitialBoardviewFocus = {
  component: string | null;
  net: string | null;
  pad: string | null;
  side: BoardviewLabSideFilter;
};

function normalizeLookupValue(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

export function resolveInitialBoardviewSelection(
  model: BoardviewLabModel,
  focus: InitialBoardviewFocus,
  query: string,
) {
  const normalizedComponent = normalizeLookupValue(focus.component);
  const normalizedNet = normalizeLookupValue(focus.net);
  const normalizedPad = normalizeLookupValue(focus.pad);

  if (normalizedPad) {
    const matchingPad =
      model.padPins.find((item) => normalizeLookupValue(item.id) === normalizedPad) ?? null;
    if (matchingPad) {
      return {
        kind: "padPin" as const,
        padPin: matchingPad,
        component: model.componentsByIndex.get(matchingPad.partIndex) ?? null,
        net: model.netsByName.get(matchingPad.netName) ?? null,
      };
    }

    const matchingTestPoint =
      model.testPoints.find((item) => normalizeLookupValue(item.id) === normalizedPad) ?? null;
    if (matchingTestPoint) {
      return {
        kind: "testPoint" as const,
        testPoint: matchingTestPoint,
        net: model.netsByName.get(matchingTestPoint.netName) ?? null,
      };
    }
  }

  if (normalizedComponent) {
    const component = model.componentsByRef.get(normalizedComponent) ?? null;
    if (component) {
      return {
        kind: "component" as const,
        component,
      };
    }
  }

  if (normalizedNet) {
    const net =
      model.nets.find((item) => normalizeLookupValue(item.name) === normalizedNet) ?? null;
    if (net) {
      return {
        kind: "net" as const,
        net,
      };
    }
  }

  const fallbackQuery = (focus.component ?? focus.net ?? focus.pad ?? query).trim();
  if (!fallbackQuery) {
    return null;
  }

  return searchBoardviewLabModel(model, fallbackQuery, focus.side, 1)[0]?.selection ?? null;
}

export function resolveInitialSideFilter(
  selection: BoardviewLabSelection,
  requestedSide: BoardviewLabSideFilter,
) {
  if (requestedSide !== "both") {
    if (selection.kind === "net") {
      return requestedSide;
    }

    const selectionSide =
      selection.kind === "component"
        ? selection.component.mountingSide
        : selection.kind === "padPin"
          ? selection.padPin.side
          : selection.kind === "testPoint"
            ? selection.testPoint.side
            : "both";

    if (selectionSide === requestedSide || selectionSide === "both") {
      return requestedSide;
    }
  }

  if (selection.kind === "component") {
    return selection.component.mountingSide === "both"
      ? "both"
      : selection.component.mountingSide;
  }

  if (selection.kind === "padPin") {
    return selection.padPin.side === "both" ? "both" : selection.padPin.side;
  }

  if (selection.kind === "testPoint") {
    return selection.testPoint.side === "both" ? "both" : selection.testPoint.side;
  }

  return requestedSide;
}
