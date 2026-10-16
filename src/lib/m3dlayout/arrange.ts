import type { SpatialFurniture } from "@/lib/spatial-model";
import { titleNameForClass } from "./vocabulary";
import { furnitureCategoryForClass } from "./scene-adapter";

type Piece = { className: string; count: number };
type Box = { x: number; y: number; width: number; depth: number };
type Size = { width: number; depth: number; height: number };

const DEFAULT_SIZE: Record<string, Size> = {
  sofa: { width: 210, depth: 90, height: 80 },
  l_shaped_sofa: { width: 250, depth: 160, height: 80 },
  loveseat_sofa: { width: 150, depth: 85, height: 80 },
  multi_seat_sofa: { width: 210, depth: 90, height: 80 },
  coffee_table: { width: 110, depth: 60, height: 42 },
  tv: { width: 130, depth: 18, height: 75 },
  tv_stand: { width: 150, depth: 42, height: 50 },
  tv_monitor: { width: 110, depth: 18, height: 65 },
  rug: { width: 240, depth: 170, height: 2 },
  armchair: { width: 80, depth: 80, height: 85 },
  dining_table: { width: 160, depth: 90, height: 75 },
  dining_chair: { width: 46, depth: 50, height: 92 },
  counter: { width: 220, depth: 60, height: 90 },
  beverage_fridge: { width: 70, depth: 70, height: 170 },
  cabinet: { width: 90, depth: 45, height: 90 },
  kitchen_cabinet: { width: 90, depth: 45, height: 90 },
  toilet: { width: 40, depth: 68, height: 45 },
  sink: { width: 60, depth: 48, height: 85 },
  bathtub: { width: 170, depth: 75, height: 58 },
  nightstand: { width: 50, depth: 40, height: 55 },
  floor_lamp: { width: 36, depth: 36, height: 150 },
  desk_lamp: { width: 24, depth: 24, height: 45 },
  ceiling_lamp: { width: 40, depth: 40, height: 20 },
  pendant_lamp: { width: 30, depth: 30, height: 40 },
  bed: { width: 160, depth: 210, height: 50 },
  kids_bed: { width: 100, depth: 180, height: 50 },
  wardrobe: { width: 120, depth: 60, height: 200 },
  chair: { width: 50, depth: 52, height: 90 },
  table: { width: 120, depth: 70, height: 75 },
};

function sizeOf(className: string): Size {
  return DEFAULT_SIZE[className] ?? { width: 70, depth: 60, height: 75 };
}

export function pieceFootprint(className: string): { width: number; depth: number } {
  const size = sizeOf(className);
  return { width: size.width, depth: size.depth };
}

function fit(size: Size, box: Box): Size {
  return {
    width: Math.min(size.width, Math.max(30, box.width - 24)),
    depth: Math.min(size.depth, Math.max(20, box.depth - 24)),
    height: size.height,
  };
}

function makeItem(
  className: string,
  box: Box,
  size: Size,
  rotation: number,
  roomId: string,
  id: string,
): SpatialFurniture {
  const fitted = fit(size, box);
  const x = Math.min(Math.max(box.x, box.x), box.x + box.width - fitted.width);
  const y = Math.min(Math.max(box.y, box.y), box.y + box.depth - fitted.depth);
  const category = furnitureCategoryForClass(className);
  return {
    id,
    name: titleNameForClass(className),
    code: className.toUpperCase(),
    category,
    roomId,
    x,
    y,
    width: fitted.width,
    depth: fitted.depth,
    height: fitted.height,
    rotation,
    isFixed: false,
    isStableSupport: category === "desk" || category === "table" || category === "bench" || category === "cabinet",
    isConfirmed: false,
    detectionConfidence: 0.8,
    notes: "Placed from the room description. The model does not decide this position.",
  };
}

function clampBox(item: SpatialFurniture, box: Box): SpatialFurniture {
  return {
    ...item,
    x: Math.min(Math.max(item.x, box.x), box.x + box.width - item.width),
    y: Math.min(Math.max(item.y, box.y), box.y + box.depth - item.depth),
  };
}

function expand(pieces: Piece[]): string[] {
  return pieces.flatMap((piece) => Array.from({ length: Math.max(1, piece.count) }, () => piece.className));
}

function take(pool: string[], names: string[]): string | undefined {
  const index = pool.findIndex((name) => names.includes(name));
  if (index < 0) return undefined;
  return pool.splice(index, 1)[0];
}

function takeAll(pool: string[], names: string[]): string[] {
  const found: string[] = [];
  let next = take(pool, names);
  while (next) {
    found.push(next);
    next = take(pool, names);
  }
  return found;
}

function spread(origin: number, length: number, size: number, count: number): number[] {
  if (count <= 1) return [origin + (length - size) / 2];
  const gap = (length - count * size) / (count + 1);
  return Array.from({ length: count }, (_, index) => origin + gap * (index + 1) + size * index);
}

function chairsAround(
  table: SpatialFurniture,
  count: number,
  box: Box,
  roomId: string,
  idPrefix: string,
  chairSize?: Size,
): SpatialFurniture[] {
  const chair = chairSize ?? fit(sizeOf("dining_chair"), box);
  const south = count >= 6 ? 2 : count >= 2 ? Math.ceil(count / 2) : count;
  const north = count >= 6 ? 2 : Math.max(0, count - south - (count >= 4 ? 2 : 0));
  const side = count >= 6 ? 1 : count >= 4 ? 1 : 0;
  const groups = [
    { count: south, rotation: 0, along: "x" as const, fixed: table.y + table.depth + 10 },
    { count: north, rotation: 0, along: "x" as const, fixed: table.y - chair.depth - 10 },
    { count: side, rotation: 0, along: "y" as const, fixed: table.x - chair.width - 10 },
    { count: side, rotation: 0, along: "y" as const, fixed: table.x + table.width + 10 },
  ];
  const chairs: SpatialFurniture[] = [];
  let index = 0;
  for (const group of groups) {
    if (group.count <= 0) continue;
    const positions = spread(
      group.along === "x" ? table.x : table.y,
      group.along === "x" ? table.width : table.depth,
      group.along === "x" ? chair.width : chair.depth,
      group.count,
    );
    for (const position of positions) {
      const x = group.along === "x" ? position : group.fixed;
      const y = group.along === "x" ? group.fixed : position;
      chairs.push(
        clampBox(
          makeItem("dining_chair", box, chair, group.rotation, roomId, `${idPrefix}-chair-${index}`),
          box,
        ),
      );
      chairs[chairs.length - 1] = clampBox({ ...chairs[chairs.length - 1], x, y }, box);
      index += 1;
    }
  }
  return chairs;
}

function arrangeLiving(pool: string[], box: Box, roomId: string, idPrefix: string): SpatialFurniture[] {
  const placed: SpatialFurniture[] = [];
  const screen = take(pool, ["tv_stand", "tv", "tv_monitor"]);
  const sofa = take(pool, ["sofa", "l_shaped_sofa", "loveseat_sofa", "multi_seat_sofa"]);
  const table = take(pool, ["coffee_table"]);
  const margin = 16;
  let cursorY = box.y + margin;

  if (screen) {
    const size = fit(sizeOf(screen), box);
    const item = makeItem(screen, box, size, 0, roomId, `${idPrefix}-screen`);
    item.x = box.x + (box.width - size.width) / 2;
    item.y = cursorY;
    placed.push(clampBox(item, box));
    cursorY = item.y + size.depth + 18;
  }
  if (table && sofa) {
    const tableSize = fit(sizeOf(table), box);
    const sofaSize = fit(sizeOf(sofa), box);
    const tableItem = makeItem(table, box, tableSize, 0, roomId, `${idPrefix}-table`);
    tableItem.x = box.x + (box.width - tableSize.width) / 2;
    tableItem.y = cursorY;
    const sofaItem = makeItem(sofa, box, sofaSize, 0, roomId, `${idPrefix}-sofa`);
    sofaItem.x = box.x + (box.width - sofaSize.width) / 2;
    sofaItem.y = tableItem.y + tableSize.depth + 16;
    placed.push(clampBox(tableItem, box), clampBox(sofaItem, box));
    const rug = take(pool, ["rug"]);
    if (rug) {
      const rugSize = fit(
        { width: Math.max(sofaSize.width, tableSize.width) + 36, depth: sofaItem.y + sofaSize.depth - tableItem.y + 20, height: 2 },
        box,
      );
      const rugItem = makeItem(rug, box, rugSize, 0, roomId, `${idPrefix}-rug`);
      rugItem.x = box.x + (box.width - rugSize.width) / 2;
      rugItem.y = tableItem.y - 10;
      placed.unshift(clampBox(rugItem, box));
    }
    cursorY = sofaItem.y + sofaSize.depth + 20;
  } else if (sofa) {
    const size = fit(sizeOf(sofa), box);
    const item = makeItem(sofa, box, size, 0, roomId, `${idPrefix}-sofa`);
    item.x = box.x + (box.width - size.width) / 2;
    item.y = Math.max(cursorY, box.y + box.depth - size.depth - margin);
    placed.push(clampBox(item, box));
  }

  let side = 0;
  for (const className of pool) {
    const size = fit(sizeOf(className), box);
    const item = makeItem(className, box, size, 0, roomId, `${idPrefix}-extra-${side}`);
    item.x = box.x + margin + (side % 2) * (box.width / 2);
    item.y = box.y + box.depth - size.depth - margin;
    placed.push(clampBox(item, box));
    side += 1;
  }
  return placed;
}

function arrangeKitchen(pool: string[], box: Box, roomId: string, idPrefix: string): SpatialFurniture[] {
  const placed: SpatialFurniture[] = [];
  const counter = take(pool, ["counter", "kitchen_cabinet"]);
  const fridge = take(pool, ["beverage_fridge"]);
  const cabinet = take(pool, ["cabinet", "kitchen_cabinet"]);
  const tableName = take(pool, ["dining_table", "table"]);
  const chairs = takeAll(pool, ["dining_chair", "chair"]);
  const margin = 14;
  let topX = box.x + margin;

  if (cabinet) {
    const size = fit(sizeOf(cabinet), box);
    const item = makeItem(cabinet, box, size, 0, roomId, `${idPrefix}-cabinet`);
    item.x = topX;
    item.y = box.y + margin;
    placed.push(clampBox(item, box));
    topX += size.width + 12;
  }
  if (counter) {
    const size = fit({ ...sizeOf(counter), width: Math.min(sizeOf(counter).width, box.width * 0.55) }, box);
    const item = makeItem(counter, box, size, 0, roomId, `${idPrefix}-counter`);
    item.x = topX;
    item.y = box.y + margin;
    placed.push(clampBox(item, box));
    topX += size.width + 12;
  }
  if (fridge) {
    const size = fit(sizeOf(fridge), box);
    const item = makeItem(fridge, box, size, 0, roomId, `${idPrefix}-fridge`);
    item.x = box.x + box.width - size.width - margin;
    item.y = box.y + margin;
    placed.push(clampBox(item, box));
  }
  if (tableName) {
    const topUsed = placed.reduce((max, item) => Math.max(max, item.y + item.depth), box.y + margin);
    const areaTop = topUsed + 12;
    const areaDepth = box.y + box.depth - margin - areaTop;
    const tableSize = fit(sizeOf(tableName), box);
    const chairSize = fit(sizeOf("dining_chair"), box);
    const vertical = tableSize.depth + chairSize.depth * 2 + 20;
    const scale = vertical > areaDepth ? areaDepth / vertical : 1;
    tableSize.depth = Math.max(50, tableSize.depth * scale);
    const fittedChair = { ...chairSize, depth: Math.max(28, chairSize.depth * scale), width: chairSize.width };
    const item = makeItem(tableName, box, tableSize, 0, roomId, `${idPrefix}-dining-table`);
    item.x = box.x + (box.width - tableSize.width) / 2;
    item.y = areaTop + fittedChair.depth + 10;
    const table = clampBox(item, box);
    placed.push(table);
    placed.push(...chairsAround(table, chairs.length, box, roomId, idPrefix, fittedChair));
  }
  pool.forEach((className, index) => {
    const size = fit(sizeOf(className), box);
    const item = makeItem(className, box, size, 0, roomId, `${idPrefix}-extra-${index}`);
    item.x = box.x + margin;
    item.y = box.y + box.depth - size.depth - margin;
    placed.push(clampBox(item, box));
  });
  return placed;
}

function arrangeBathroom(pool: string[], box: Box, roomId: string, idPrefix: string): SpatialFurniture[] {
  const placed: SpatialFurniture[] = [];
  const tub = take(pool, ["bathtub"]);
  const toilets = takeAll(pool, ["toilet"]);
  const sink = take(pool, ["sink", "standing_sink"]);
  const margin = 16;
  if (tub) {
    const size = fit({ ...sizeOf(tub), width: Math.min(sizeOf(tub).width, box.width - margin * 2) }, box);
    const item = makeItem(tub, box, size, 0, roomId, `${idPrefix}-tub`);
    item.x = box.x + margin;
    item.y = box.y + box.depth - size.depth - margin;
    placed.push(clampBox(item, box));
  }
  let x = box.x + margin;
  toilets.forEach((className, index) => {
    const size = fit(sizeOf(className), box);
    const item = makeItem(className, box, size, 0, roomId, `${idPrefix}-toilet-${index}`);
    item.x = x;
    item.y = box.y + margin;
    placed.push(clampBox(item, box));
    x += size.width + 28;
  });
  if (sink) {
    const size = fit(sizeOf(sink), box);
    const item = makeItem(sink, box, size, 0, roomId, `${idPrefix}-sink`);
    item.x = x;
    item.y = box.y + margin;
    placed.push(clampBox(item, box));
  }
  pool.forEach((className, index) => {
    const size = fit(sizeOf(className), box);
    const item = makeItem(className, box, size, 0, roomId, `${idPrefix}-extra-${index}`);
    item.x = box.x + box.width - size.width - margin;
    item.y = box.y + margin;
    placed.push(clampBox(item, box));
  });
  return placed;
}

function arrangeBedroom(pool: string[], box: Box, roomId: string, idPrefix: string): SpatialFurniture[] {
  const placed: SpatialFurniture[] = [];
  const bedName = take(pool, ["bed", "kids_bed"]);
  const night = take(pool, ["nightstand"]);
  const lamp = take(pool, ["floor_lamp", "desk_lamp", "ceiling_lamp", "pendant_lamp"]);
  const wardrobe = take(pool, ["wardrobe"]);
  const margin = 16;
  if (bedName) {
    const size = fit(sizeOf(bedName), box);
    const bed = makeItem(bedName, box, size, 0, roomId, `${idPrefix}-bed`);
    bed.x = box.x + (box.width - size.width) / 2;
    bed.y = box.y + box.depth - size.depth - margin;
    placed.push(clampBox(bed, box));
    let sideX = bed.x + bed.width + 12;
    if (night) {
      const nightSize = fit(sizeOf(night), box);
      const item = makeItem(night, box, nightSize, 0, roomId, `${idPrefix}-nightstand`);
      item.x = sideX;
      item.y = bed.y;
      placed.push(clampBox(item, box));
      sideX = item.x + item.width + 10;
    }
    if (lamp) {
      const lampSize = fit(sizeOf(lamp), box);
      const item = makeItem(lamp, box, lampSize, 0, roomId, `${idPrefix}-lamp`);
      item.x = sideX;
      item.y = bed.y;
      placed.push(clampBox(item, box));
    }
  }
  if (wardrobe) {
    const size = fit(sizeOf(wardrobe), box);
    const item = makeItem(wardrobe, box, size, 0, roomId, `${idPrefix}-wardrobe`);
    item.x = box.x + margin;
    item.y = box.y + margin;
    placed.push(clampBox(item, box));
  }
  pool.forEach((className, index) => {
    const size = fit(sizeOf(className), box);
    const item = makeItem(className, box, size, 0, roomId, `${idPrefix}-extra-${index}`);
    item.x = box.x + margin;
    item.y = box.y + margin + index * (size.depth + 12);
    placed.push(clampBox(item, box));
  });
  return placed;
}

function arrangeGrid(pool: string[], box: Box, roomId: string, idPrefix: string): SpatialFurniture[] {
  const columns = Math.max(1, Math.ceil(Math.sqrt(pool.length)));
  return pool.map((className, index) => {
    const size = fit(sizeOf(className), box);
    const column = index % columns;
    const row = Math.floor(index / columns);
    const item = makeItem(className, box, size, 0, roomId, `${idPrefix}-grid-${index}`);
    item.x = box.x + 16 + column * (size.width + 16);
    item.y = box.y + 16 + row * (size.depth + 16);
    return clampBox(item, box);
  });
}

export function arrangeRoomFurniture(input: {
  pieces: Piece[];
  roomType: string;
  rect: Box;
  roomId: string;
  idPrefix: string;
}): SpatialFurniture[] {
  const box: Box = {
    x: input.rect.x + 20,
    y: input.rect.y + 20,
    width: Math.max(80, input.rect.width - 40),
    depth: Math.max(80, input.rect.depth - 40),
  };
  const pool = expand(input.pieces);
  if (input.roomType === "living room") return arrangeLiving(pool, box, input.roomId, input.idPrefix);
  if (input.roomType === "kitchen" || input.roomType === "dining room") return arrangeKitchen(pool, box, input.roomId, input.idPrefix);
  if (input.roomType === "bathroom") return arrangeBathroom(pool, box, input.roomId, input.idPrefix);
  if (input.roomType === "bedroom") return arrangeBedroom(pool, box, input.roomId, input.idPrefix);
  return arrangeGrid(pool, box, input.roomId, input.idPrefix);
}
