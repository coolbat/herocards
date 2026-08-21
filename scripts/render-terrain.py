#!/usr/bin/env python3
"""Render Natural Earth shaded relief into the atlas Web Mercator canvas."""

import argparse
import json
import math
import tempfile
import zipfile
from pathlib import Path

import numpy as np
from PIL import Image, ImageChops, ImageEnhance


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--width", required=True, type=int)
    parser.add_argument("--height", required=True, type=int)
    parser.add_argument("--west", required=True, type=float)
    parser.add_argument("--south", required=True, type=float)
    parser.add_argument("--east", required=True, type=float)
    parser.add_argument("--north", required=True, type=float)
    return parser.parse_args()


def mercator_y(latitude):
    radians = math.radians(max(-85.0, min(85.0, latitude)))
    return math.log(math.tan(math.pi / 4 + radians / 2))


def inverse_mercator(value):
    return math.degrees(2 * math.atan(math.exp(value)) - math.pi / 2)


def source_x(longitude):
    return (longitude + 180.0) * 60.0 - 0.5


def source_y(latitude):
    return (90.0 - latitude) * 60.0 - 0.5


def palette_channel(value, channel):
    stops = [
        (0.00, (9, 35, 45)),
        (0.42, (22, 66, 73)),
        (0.66, (49, 103, 88)),
        (0.82, (105, 139, 91)),
        (1.00, (205, 188, 119)),
    ]
    position = value / 255.0
    for index in range(1, len(stops)):
        if position <= stops[index][0]:
            left_position, left_color = stops[index - 1]
            right_position, right_color = stops[index]
            ratio = (position - left_position) / (right_position - left_position)
            return round(left_color[channel] + (right_color[channel] - left_color[channel]) * ratio)
    return stops[-1][1][channel]


def apply_qinglu_style(relief):
    relief = ImageEnhance.Contrast(relief).enhance(1.28)
    channels = [relief.point([palette_channel(value, channel) for value in range(256)]) for channel in range(3)]
    colored = Image.merge("RGB", channels)

    tile_size = 128
    grain_tile = Image.new("L", (tile_size, tile_size))
    grain_tile.putdata([
        246 + ((x * 17 + y * 31 + (x * y) % 19) % 10)
        for y in range(tile_size)
        for x in range(tile_size)
    ])
    grain = Image.new("L", colored.size, 255)
    for y in range(0, colored.height, tile_size):
        for x in range(0, colored.width, tile_size):
            grain.paste(grain_tile, (x, y))
    return ImageChops.multiply(colored, Image.merge("RGB", (grain, grain, grain)))


def render(source_image, args):
    source_image.load()
    source_image = source_image.convert("L")
    north_y = mercator_y(args.north)
    south_y = mercator_y(args.south)
    longitudes = np.linspace(args.west, args.east, args.width, dtype=np.float64)
    mercator_rows = np.linspace(north_y, south_y, args.height, dtype=np.float64)
    latitudes = np.degrees(2 * np.arctan(np.exp(mercator_rows)) - np.pi / 2)
    x_coordinates = np.clip((longitudes + 180.0) * 60.0 - 0.5, 0, source_image.width - 1)
    y_coordinates = np.clip((90.0 - latitudes) * 60.0 - 0.5, 0, source_image.height - 1)
    x0 = np.floor(x_coordinates).astype(np.int32)
    y0 = np.floor(y_coordinates).astype(np.int32)
    x1 = np.minimum(x0 + 1, source_image.width - 1)
    y1 = np.minimum(y0 + 1, source_image.height - 1)
    x_weight = (x_coordinates - x0).astype(np.float32)[None, :]
    y_weight = (y_coordinates - y0).astype(np.float32)[:, None]
    source = np.asarray(source_image, dtype=np.uint8)
    top = source[np.ix_(y0, x0)].astype(np.float32) * (1 - x_weight)
    top += source[np.ix_(y0, x1)].astype(np.float32) * x_weight
    bottom = source[np.ix_(y1, x0)].astype(np.float32) * (1 - x_weight)
    bottom += source[np.ix_(y1, x1)].astype(np.float32) * x_weight
    projected_array = np.clip(top * (1 - y_weight) + bottom * y_weight, 0, 255).astype(np.uint8)
    projected = Image.fromarray(projected_array)
    return apply_qinglu_style(projected)


def main():
    args = parse_args()
    source_path = Path(args.source)
    output_path = Path(args.output)
    Image.MAX_IMAGE_PIXELS = None

    with tempfile.TemporaryDirectory(prefix="herocards-terrain-") as temporary_directory:
        if source_path.suffix.lower() == ".zip":
            with zipfile.ZipFile(source_path) as archive:
                member = next((name for name in archive.namelist() if name.endswith("SR_HR.tif")), None)
                if not member:
                    raise RuntimeError("SR_HR.tif is missing from the Natural Earth archive")
                archive.extract(member, temporary_directory)
                raster_path = Path(temporary_directory, member)
        else:
            raster_path = source_path

        with Image.open(raster_path) as source_image:
            terrain = render(source_image, args)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        terrain.save(output_path, "JPEG", quality=86, optimize=True, progressive=True, subsampling=2)
        preview = np.asarray(terrain.convert("L").resize((48, 32), Image.Resampling.LANCZOS), dtype=np.int16)
        print(json.dumps({
            "horizontalMeanDifference": float(np.abs(np.diff(preview, axis=1)).mean()),
            "verticalMeanDifference": float(np.abs(np.diff(preview, axis=0)).mean()),
            "luminanceRange": [int(preview.min()), int(preview.max())],
        }, sort_keys=True))


if __name__ == "__main__":
    main()
