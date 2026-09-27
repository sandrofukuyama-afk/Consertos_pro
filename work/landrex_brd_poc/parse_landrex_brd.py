from __future__ import annotations

import argparse
import json
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Iterable


ENCODED_HEADER = bytes([0x23, 0xE2, 0x63, 0x28])
MIL_TO_MM = 0.0254


@dataclass
class BoardPoint:
    x: int
    y: int


@dataclass
class Part:
    ref: str
    raw_type: int
    end_of_pins: int


@dataclass
class Pin:
    x: int
    y: int
    probe: int
    part_index: int
    net: str


@dataclass
class Nail:
    probe: int
    x: int
    y: int
    side: int
    net: str


@dataclass
class BoardviewSummary:
    file_path: str
    decoded_variant: str
    declared_counts: dict[str, int]
    parsed_counts: dict[str, int]
    board_bounds_mil: dict[str, int]
    board_size_mil: dict[str, int]
    board_size_mm: dict[str, float]
    examples: dict[str, list[dict[str, object]]]


def decode_landrex_bytes(raw: bytes) -> tuple[bytes, str]:
    if raw[:4] != ENCODED_HEADER:
        return raw, "plain-text-or-unknown-variant"

    data = bytearray(raw)
    for index, value in enumerate(data):
        if value in (0, 10, 13):
            continue
        rotated = ((value >> 6) & 0x03) | ((value << 2) & 0xFF)
        data[index] = (~rotated) & 0xFF
    return bytes(data), "encoded-landrex-testlink"


def iter_non_empty_lines(text: str) -> Iterable[str]:
    for line in text.splitlines():
        stripped = line.strip()
        if stripped:
            yield stripped


def parse_boardview(decoded: bytes, source_path: Path) -> BoardviewSummary:
    text = decoded.decode("latin-1", "replace")
    lines = list(iter_non_empty_lines(text))

    current_block = None
    declared_format = 0
    declared_parts = 0
    declared_pins = 0
    declared_nails = 0

    format_points: list[BoardPoint] = []
    parts: list[Part] = []
    pins: list[Pin] = []
    nails: list[Nail] = []

    for line in lines:
        if line in {"str_length:", "var_data:", "Format:", "format:", "Parts:", "Pins1:", "Pins:", "Pins2:", "Nails:"}:
            current_block = line
            continue

        tokens = line.split()
        if not tokens:
            continue

        if current_block == "var_data:":
            if len(tokens) < 4:
                raise ValueError(f"Unexpected var_data line: {line!r}")
            declared_format = int(tokens[0])
            declared_parts = int(tokens[1])
            declared_pins = int(tokens[2])
            declared_nails = int(tokens[3])
            continue

        if current_block in {"Format:", "format:"}:
            if len(tokens) < 2:
                raise ValueError(f"Unexpected format line: {line!r}")
            format_points.append(BoardPoint(x=int(tokens[0]), y=int(tokens[1])))
            continue

        if current_block in {"Parts:", "Pins1:"}:
            if len(tokens) < 3:
                raise ValueError(f"Unexpected part line: {line!r}")
            parts.append(
                Part(
                    ref=tokens[0],
                    raw_type=int(tokens[1]),
                    end_of_pins=int(tokens[2]),
                )
            )
            continue

        if current_block in {"Pins:", "Pins2:"}:
            if len(tokens) < 5:
                raise ValueError(f"Unexpected pin line: {line!r}")
            pins.append(
                Pin(
                    x=int(tokens[0]),
                    y=int(tokens[1]),
                    probe=int(tokens[2]),
                    part_index=int(tokens[3]),
                    net=" ".join(tokens[4:]),
                )
            )
            continue

        if current_block == "Nails:":
            if len(tokens) < 5:
                raise ValueError(f"Unexpected nail line: {line!r}")
            nails.append(
                Nail(
                    probe=int(tokens[0]),
                    x=int(tokens[1]),
                    y=int(tokens[2]),
                    side=int(tokens[3]),
                    net=" ".join(tokens[4:]),
                )
            )
            continue

    if not format_points:
        raise ValueError("No format points found in decoded boardview")

    xs = [point.x for point in format_points]
    ys = [point.y for point in format_points]
    min_x, max_x = min(xs), max(xs)
    min_y, max_y = min(ys), max(ys)
    width_mil = max_x - min_x
    height_mil = max_y - min_y

    distinct_nets = {
        net
        for net in [*(pin.net for pin in pins), *(nail.net for nail in nails)]
        if net and net.upper() not in {"UNCONNECTED", "NC"}
    }

    summary = BoardviewSummary(
        file_path=str(source_path),
        decoded_variant="encoded-landrex-testlink" if decoded[:4] != raw_preview(decoded[:4]) else "plain-text-or-unknown-variant",  # replaced below
        declared_counts={
            "format_points": declared_format,
            "parts": declared_parts,
            "pins": declared_pins,
            "nails": declared_nails,
            "nets_distinct": len(distinct_nets),
        },
        parsed_counts={
            "format_points": len(format_points),
            "parts": len(parts),
            "pins": len(pins),
            "nails": len(nails),
            "nets_distinct": len(distinct_nets),
        },
        board_bounds_mil={
            "min_x": min_x,
            "max_x": max_x,
            "min_y": min_y,
            "max_y": max_y,
        },
        board_size_mil={
            "width": width_mil,
            "height": height_mil,
        },
        board_size_mm={
            "width": round(width_mil * MIL_TO_MM, 2),
            "height": round(height_mil * MIL_TO_MM, 2),
        },
        examples={
            "parts": [asdict(part) for part in parts[:10]],
            "pins": [asdict(pin) for pin in pins[:10]],
            "nails": [asdict(nail) for nail in nails[:10]],
            "nets": [{"name": net} for net in sorted(distinct_nets)[:20]],
        },
    )

    return summary


def raw_preview(data: bytes) -> bytes:
    return data


def render_human(summary: BoardviewSummary) -> str:
    lines: list[str] = []
    lines.append(f"Arquivo: {summary.file_path}")
    lines.append(f"Variant detectado: {summary.decoded_variant}")
    lines.append("")
    lines.append("Contagens declaradas:")
    for key, value in summary.declared_counts.items():
        lines.append(f"  - {key}: {value}")
    lines.append("")
    lines.append("Contagens lidas:")
    for key, value in summary.parsed_counts.items():
        lines.append(f"  - {key}: {value}")
    lines.append("")
    lines.append("Dimensoes estimadas da placa:")
    lines.append(
        f"  - largura: {summary.board_size_mil['width']} mil ({summary.board_size_mm['width']} mm)"
    )
    lines.append(
        f"  - altura: {summary.board_size_mil['height']} mil ({summary.board_size_mm['height']} mm)"
    )
    lines.append("")
    lines.append("Exemplos de referencias:")
    for part in summary.examples["parts"][:10]:
        lines.append(f"  - {part['ref']}")
    lines.append("")
    lines.append("Exemplos de nets:")
    for net in summary.examples["nets"][:10]:
        lines.append(f"  - {net['name']}")
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description="PoC isolada para leitura de boardview BRD Landrex/Testlink")
    parser.add_argument("board_file", type=Path, help="Caminho para o arquivo .brd")
    parser.add_argument("--json", action="store_true", help="Emitir saida JSON")
    args = parser.parse_args()

    raw = args.board_file.read_bytes()
    decoded, variant = decode_landrex_bytes(raw)
    summary = parse_boardview(decoded, args.board_file)
    summary.decoded_variant = variant

    if args.json:
        print(json.dumps(asdict(summary), ensure_ascii=False, indent=2))
    else:
        print(render_human(summary))

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
