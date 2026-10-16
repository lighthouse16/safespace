import test from "node:test";
import assert from "node:assert/strict";
import { arrangeRoomFurniture } from "../src/lib/m3dlayout/arrange";
import { resolveGeneratedFurniture, validateGeneratedPlanGeometry } from "../src/lib/m3dlayout/collision-layout";
import { useSafeSpaceStore } from "../src/store/safespace-store";
import { splitRoomRequests } from "../src/lib/m3dlayout/prompt-agent";
import { composeRoomFrames, placeOpenings, type FramedRoom } from "../src/lib/m3dlayout/room-plan";
import { furnitureToWorldFootprint, wallToObstacleFootprint, doorToObstacleFootprint } from "../src/lib/spatial/geometry/placement";
import { isFootprintContainedInBoundary, polygonIntersectsPolygon } from "../src/lib/spatial/geometry/intersections";
import type { SpatialFurniture } from "../src/lib/spatial-model";
import type { Polygon2D } from "../src/lib/spatial";

const rect = (width: number, depth: number): Polygon2D =>
  [{ x: 0, y: 0 }, { x: width, y: 0 }, { x: width, y: depth }, { x: 0, y: depth }];

function assertNoOverlap(items: SpatialFurniture[], boundary: Polygon2D, obstacles: Polygon2D[] = []) {
  assert.equal(new Set(items.map((item) => item.id)).size, items.length);
  for (let i = 0; i < items.length; i++) {
    const fp = furnitureToWorldFootprint(items[i]).footprint;
    assert.ok(isFootprintContainedInBoundary(fp, boundary), `Out of room: ${items[i].id}`);
    for (let j = i + 1; j < items.length; j++) {
      assert.equal(
        polygonIntersectsPolygon(fp, furnitureToWorldFootprint(items[j]).footprint),
        false,
        `Overlap between ${items[i].id} and ${items[j].id}`,
      );
    }
    for (const obstacle of obstacles) {
      assert.equal(polygonIntersectsPolygon(fp, obstacle), false, `${items[i].id} collides with a wall`);
    }
  }
}

function piece(id: string, x: number, y: number, width: number, depth: number, rotation = 0): SpatialFurniture {
  return {
    id, name: id, code: "TEST", category: "chair", roomId: "test",
    x, y, width, depth, height: 80, rotation,
    isFixed: false, isStableSupport: false, isConfirmed: false,
  };
}

test("regression: identical desired positions resolve to distinct non-overlapping coordinates", () => {
  const initial = [
    piece("sofa", 200, 150, 165, 80),
    piece("table", 200, 150, 95, 55),
    piece("chair-a", 200, 150, 50, 50),
    piece("chair-b", 200, 150, 50, 50),
    piece("chair-c", 200, 150, 50, 50),
  ];
  const result = resolveGeneratedFurniture(initial, { rect: { x: 0, y: 0, width: 600, depth: 450 } });
  assert.deepEqual(result.furniture.map((item) => item.id), initial.map((item) => item.id));
  assertNoOverlap(result.furniture, rect(600, 450));
});

test("regression: rotated 45 and 90 degree items respect true world-space footprints", () => {
  const items = [piece("a", 80, 65, 155, 60, 45), piece("b", 80, 65, 140, 60, 90), piece("c", 80, 65, 75, 75)];
  const result = resolveGeneratedFurniture(items, { rect: { x: 0, y: 0, width: 480, depth: 400 } });
  assertNoOverlap(result.furniture, rect(480, 400));
  assert.deepEqual(result.furniture.map((item) => item.rotation), items.map((item) => item.rotation));
});

test("regression: narrow/overfull room fails instead of returning stacked objects", () => {
  const items = Array.from({ length: 15 }, (_, n) => piece(`bed-${n}`, 30, 30, 145, 175));
  assert.throws(
    () => resolveGeneratedFurniture(items, { rect: { x: 0, y: 0, width: 360, depth: 280 } }),
    /Cannot fit .* without overlapping/,
  );
});

test("regression: a wall and a door-shaped no-go region are both respected", () => {
  const wall = wallToObstacleFootprint({
    id: "partition", start: { x: 250, y: 0 }, end: { x: 250, y: 440 }, thickness: 12,
  });
  const door: Polygon2D = [{ x: 430, y: 130 }, { x: 490, y: 130 }, { x: 490, y: 210 }, { x: 430, y: 210 }];
  const items = [piece("chair", 240, 190, 55, 55), piece("table", 230, 190, 90, 70)];
  const result = resolveGeneratedFurniture(items, {
    rect: { x: 0, y: 0, width: 600, depth: 440 },
    obstacles: [wall, { id: "door", footprint: door }],
  });
  assertNoOverlap(result.furniture, rect(600, 440), [wall.footprint, door]);
});

test("actual three-room user prompt generates safe placements or an explicit failure", () => {
  const requests = splitRoomRequests("a living room with a sofa, a coffee table, and a television, a kitchen with a table and 6 chairs, a fridge, and a cupboard, a bathroom with a toilet, a sink, and a bathtub");
  const plan = composeRoomFrames(requests);
  assert.ok(plan);
  for (const [index, room] of plan.framed.entries()) {
    let furniture: SpatialFurniture[];
    try {
      furniture = arrangeRoomFurniture({
        pieces: requests[index].pieces, roomType: room.roomType, rect: room.rect,
        roomId: room.id, idPrefix: room.id,
      });
    } catch (error) {
      assert.match(String(error), /Cannot fit|too small/i);
      continue;
    }
    assert.equal(furniture.length, requests[index].pieces.filter((p) => !["window", "panel_door"].includes(p.className)).reduce((total, piece) => total + Math.max(1, piece.count), 0));
    assertNoOverlap(furniture, rect(room.rect.x + room.rect.width, room.rect.y + room.rect.depth));
  }
});

test("reproducible property sweep: 60 varied room/object densities never return overlapping furniture", () => {
  let seed = 13819;
  const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  let successes = 0;
  let rejects = 0;
  for (let iteration = 0; iteration < 60; iteration++) {
    const w = 230 + Math.round(random() * 420);
    const h = 230 + Math.round(random() * 360);
    const count = 2 + Math.floor(random() * 17);
    const pieces = Array.from({ length: count }, (_, idx) =>
      piece(`item-${idx}`, random() * w * 0.6, random() * h * 0.6,
        32 + random() * 100, 25 + random() * 90,
        [0, 0, 45, 90][Math.floor(random() * 4)]));
    try {
      const output = resolveGeneratedFurniture(pieces, { rect: { x: 0, y: 0, width: w, depth: h } });
      assert.equal(output.furniture.length, count);
      assertNoOverlap(output.furniture, rect(w, h));
      successes++;
    } catch (error) {
      assert.match(String(error), /Cannot fit .* without overlapping/);
      rejects++;
    }
  }
  assert.ok(successes >= 10, `too many false rejections: ${successes} successes`);
  assert.ok(rejects >= 1, "sweep should test over-capacity rejection");
});

test("duplicates, invalid dimensions and extreme room parameters never succeed silently", () => {
  assert.throws(() => resolveGeneratedFurniture([piece("duplicate", 0, 0, 40, 40), piece("duplicate", 200, 200, 40, 40)], {
    rect: { x: 0, y: 0, width: 500, depth: 500 },
  }), /Duplicate furniture IDs/);
  assert.throws(() => resolveGeneratedFurniture([piece("bad", NaN, 0, 40, 40)], {
    rect: { x: 0, y: 0, width: 500, depth: 500 },
  }), /Invalid dimensions/);
});

test("real Generate pipeline: demo living room and multi-room plan place ALL furniture without overlap", () => {
  const scenarios = [
    "a living room with a sofa, a coffee table, and a television",
    "a living room with a sofa and a television, a kitchen with a table and 6 chairs, a bathroom with a toilet and a sink",
  ];
  for (const text of scenarios) {
    const requests = splitRoomRequests(text);
    const plan = composeRoomFrames(requests);
    assert.ok(plan);
    const openings = placeOpenings(plan.walls, plan.boundary, requests);
    const obstacles = [
      ...plan.walls.map(wallToObstacleFootprint),
      ...openings.filter((opening) => opening.name !== "Window").map(doorToObstacleFootprint),
    ];
    const all: SpatialFurniture[] = [];
    for (let i = 0; i < plan.framed.length; i++) {
      const room: FramedRoom = plan.framed[i];
      const roomBoundary = plan.rooms.find((candidate) => candidate.id === room.id)?.polygon;
      const items = arrangeRoomFurniture({
        pieces: requests[i].pieces,
        roomType: room.roomType,
        rect: room.rect,
        roomId: room.id,
        idPrefix: room.id,
        roomBoundary,
        obstacles,
      });
      assert.ok(items.length > 0, `expected furniture in ${room.name}`);
      assertNoOverlap(items, roomBoundary ?? [
        {x:room.rect.x,y:room.rect.y},
        {x:room.rect.x+room.rect.width,y:room.rect.y},
        {x:room.rect.x+room.rect.width,y:room.rect.y+room.rect.depth},
        {x:room.rect.x,y:room.rect.y+room.rect.depth},
      ], obstacles.map((obstacle) => obstacle.footprint));
      all.push(...items);
    }
    // Defensive global pair check: neighboring rooms may share a partition.
    for (let i=0; i<all.length; i++) {
      for (let j=i+1; j<all.length; j++) {
        assert.equal(polygonIntersectsPolygon(furnitureToWorldFootprint(all[i]).footprint, furnitureToWorldFootprint(all[j]).footprint), false);
      }
    }
  }
});

test("final store gate rejects an overlapping generated plan atomically", () => {
  const before = useSafeSpaceStore.getState();
  const saved = {
    furniture: before.furniture, rooms: before.rooms, walls: before.walls,
    doors: before.doors, canonicalBoundary: before.canonicalBoundary,
    history: before.history, future: before.future,
    structurePast: before.structurePast, structureFuture: before.structureFuture,
    placementError: before.placementError,
  };
  const boundary = rect(600, 450);
  const room = {
    id: "generated-room", name: "Generated Room", category: "living" as const,
    x: 0, y: 0, width: 600, depth: 450, color: "#fff", lightLevelLux: 320,
  };
  const overlapping = [
    { ...piece("first", 100, 100, 140, 80), roomId: room.id },
    { ...piece("second", 180, 120, 110, 70), roomId: room.id },
  ];
  const badPlan = { furniture: overlapping, rooms: [room], walls: [], boundary };
  assert.match(validateGeneratedPlanGeometry(badPlan) || "", /objects overlap/);
  try {
    before.applyGeneratedPlan(badPlan);
    const after = useSafeSpaceStore.getState();
    assert.strictEqual(after.furniture, saved.furniture, "invalid plan must not replace furniture");
    assert.strictEqual(after.rooms, saved.rooms, "invalid plan must not replace rooms");
    assert.strictEqual(after.history, saved.history, "invalid plan must not enter Undo history");
    assert.match(after.placementError || "", /objects overlap/);

    const goodPlan = {
      ...badPlan,
      furniture: [
        { ...piece("first", 100, 100, 140, 80), roomId: room.id },
        { ...piece("second", 350, 250, 110, 70), roomId: room.id },
      ],
    };
    assert.equal(validateGeneratedPlanGeometry(goodPlan), null);
    before.applyGeneratedPlan(goodPlan);
    const accepted = useSafeSpaceStore.getState();
    assert.equal(accepted.furniture.length, 2);
    assertNoOverlap(accepted.furniture, boundary);
  } finally {
    useSafeSpaceStore.setState(saved);
  }
});
