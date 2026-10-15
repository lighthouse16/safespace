import test from "node:test";
import assert from "node:assert/strict";
import { splitRoomRequests, translateUserQuery } from "../src/lib/m3dlayout/prompt-agent";
import { composeRoomFrames } from "../src/lib/m3dlayout/room-plan";
import { isM3DClassLabel } from "../src/lib/m3dlayout/vocabulary";
import { furnitureCategoryForClass, sceneToFurniture } from "../src/lib/m3dlayout/scene-adapter";
import { isPointInPolygon, polygonArea } from "../src/lib/spatial/geometry/polygons";
import { arrangeRoomFurniture } from "../src/lib/m3dlayout/arrange";
import { normalizeApiBase } from "../src/lib/m3dlayout/client";

test("a multi-room sentence becomes one model prompt per room", () => {
  const query =
    "a living room with a sofa, a coffee table, and a television, a kitchen with a countertop, a table with 6 chairs, a fridge, a cupboard, a toilet with a sink, a toilet, a hottub";
  const rooms = splitRoomRequests(query);
  assert.deepEqual(
    rooms.map((room) => room.roomType),
    ["living room", "kitchen", "bathroom"],
  );
  assert.match(rooms[0].prompt, /The room is a living room/);
  assert.equal(rooms[0].prompt.includes("kitchen"), false);
  assert.match(rooms[1].prompt, /The room is a kitchen/);
  assert.match(rooms[1].prompt, /six dining chairs/);
  assert.match(rooms[1].prompt, /dining table/);
  assert.match(rooms[2].prompt, /The room is a bathroom/);
  assert.match(rooms[2].prompt, /bathtub/);
  assert.equal(rooms[2].classes.includes("sofa"), false);

  const plan = composeRoomFrames(rooms);
  assert.ok(plan);
  assert.equal(plan.rooms.length, 3);
  const [living, kitchen, bathroom] = plan.rooms;
  assert.equal(kitchen.x, living.x + living.width);
  assert.equal(bathroom.x, kitchen.x);
  assert.equal(bathroom.y, kitchen.y + kitchen.depth);
  assert.equal(living.depth, kitchen.depth + bathroom.depth);
  const livingItems = plan.framed[0];
  assert.ok(livingItems.frame.centerX > living.x && livingItems.frame.centerX < living.x + living.width);
});

test("short living-room request becomes a training-style description", () => {
  const result = translateUserQuery("a living room with a sofa and a tv");
  assert.equal(result.ready, true);
  assert.equal(result.style, "rewritten");
  assert.equal(result.roomType, "living room");
  assert.deepEqual(result.classes, ["sofa", "tv"]);
  assert.match(result.prompt, /^The room is a living room\. There is a sofa and a television\./);
  assert.match(result.prompt, /A sofa faces a television/);
  assert.equal(result.prompt.includes("coffee table"), false);
});

test("coffee table stays a coffee table and a facing relation is kept", () => {
  const result = translateUserQuery(
    "living room with a sofa facing the television and a coffee table in front of the sofa",
  );
  assert.deepEqual(result.classes, ["sofa", "tv", "coffee_table"]);
  assert.match(result.prompt, /A sofa faces a television/);
  assert.match(result.prompt, /A coffee table is in front of a sofa/);
  assert.equal(result.classes.every(isM3DClassLabel), true);
});

test("a paper-style paragraph is sent unchanged", () => {
  const original =
    "The room is a living room with an arrangement centered around relaxation. A large sectional sofa faces a television stand, while a low coffee table sits in front of the sofa.";
  const result = translateUserQuery(original);
  assert.equal(result.style, "passthrough");
  assert.equal(result.prompt, original);
  assert.equal(result.classes.includes("l_shaped_sofa"), true);
  assert.equal(result.classes.includes("tv_stand"), true);
  assert.equal(result.classes.includes("coffee_table"), true);
});

test("bedroom is not detected as a bed, and an unnamed bedroom gets the default set", () => {
  const result = translateUserQuery("a quiet bedroom");
  assert.equal(result.roomType, "bedroom");
  assert.deepEqual(result.classes, ["bed", "nightstand", "wardrobe"]);
  assert.match(result.note, /typical bedroom set/);
});

test("scene boxes use floor XZ, centimeters, and the room center", () => {
  const furniture = sceneToFurniture(
    {
      class_names: ["start", "sofa", "coffee_table", "end"],
      translations: [
        [0, 0, 0],
        [0, 0.4, 0],
        [4, 0.25, 0],
        [0, 0, 0],
      ],
      sizes: [
        [0, 0, 0],
        [2, 0.8, 1],
        [1, 0.4, 0.6],
        [0, 0, 0],
      ],
      angles: [0, [0], [Math.PI / 2], 0],
    },
    { roomId: "room-waiting", centerX: 300, centerY: 220, maxWidthCm: 400, maxDepthCm: 300 },
  );
  assert.equal(furniture.length, 2);
  assert.equal(furniture[0].name, "Sofa");
  assert.equal(furniture[0].category, "bench");
  assert.equal(furniture[1].category, "table");
  assert.equal(furniture[0].roomId, "room-waiting");
  assert.equal(furniture[1].rotation, 90);
  const sofaCenterX = furniture[0].x + furniture[0].width / 2;
  const tableCenterX = furniture[1].x + furniture[1].width / 2;
  assert.ok(sofaCenterX < 300);
  assert.ok(tableCenterX > 300);
  assert.ok(furniture.every((item) => item.width <= 400 && item.depth <= 300));
});

test("category mapping keeps desks distinct from tables", () => {
  assert.equal(furnitureCategoryForClass("desk"), "desk");
  assert.equal(furnitureCategoryForClass("dining_table"), "table");
  assert.equal(furnitureCategoryForClass("tv_stand"), "cabinet");
  assert.equal(furnitureCategoryForClass("floor_lamp"), "light");
});

test("api base rejects a bare host and strips a trailing slash", () => {
  assert.equal(normalizeApiBase("https://demo.ngrok-free.app/"), "https://demo.ngrok-free.app");
  assert.throws(() => normalizeApiBase("demo.ngrok-free.app"), /https?:\/\//);
});

test("requested furniture is placed by relation and extra model classes are absent", () => {
  const query =
    "a living room with a sofa, a coffee table, and a television, a kitchen with a countertop, a table with 6 chairs, a fridge, a cupboard, a toilet with a sink, a toilet, a hottub";
  const rooms = splitRoomRequests(query);
  const plan = composeRoomFrames(rooms);
  assert.ok(plan);
  const living = arrangeRoomFurniture({
    pieces: rooms[0].pieces,
    roomType: rooms[0].roomType,
    rect: plan.framed[0].rect,
    roomId: plan.framed[0].id,
    idPrefix: plan.framed[0].id,
  });
  const tv = living.find((item) => item.code === "TV");
  const table = living.find((item) => item.code === "COFFEE_TABLE");
  const sofa = living.find((item) => item.code === "SOFA");
  assert.ok(tv && table && sofa);
  const center = (item: { x: number; width: number }) => item.x + item.width / 2;
  assert.ok(Math.abs(center(tv) - center(sofa)) < 8);
  assert.ok(table.y > tv.y + tv.depth - 1);
  assert.ok(sofa.y > table.y + table.depth - 1);
  assert.equal(sofa.rotation, 0);
  assert.equal(living.some((item) => item.code === "BED" || item.code?.includes("PLANT")), false);

  const kitchen = arrangeRoomFurniture({
    pieces: rooms[1].pieces,
    roomType: rooms[1].roomType,
    rect: plan.framed[1].rect,
    roomId: plan.framed[1].id,
    idPrefix: plan.framed[1].id,
  });
  const dining = kitchen.find((item) => item.code === "DINING_TABLE");
  const chairs = kitchen.filter((item) => item.code === "DINING_CHAIR");
  assert.ok(dining);
  assert.equal(chairs.length, 6);
  assert.equal(chairs.filter((chair) => chair.y > dining.y + dining.depth - 1).length, 2);
  assert.equal(chairs.filter((chair) => chair.y + chair.depth < dining.y + 1).length, 2);
  assert.equal(kitchen.some((item) => item.code === "LOUNGE_CHAIR" || item.code === "WINE_CABINET"), false);

  const bathroom = arrangeRoomFurniture({
    pieces: rooms[2].pieces,
    roomType: rooms[2].roomType,
    rect: plan.framed[2].rect,
    roomId: plan.framed[2].id,
    idPrefix: plan.framed[2].id,
  });
  const tub = bathroom.find((item) => item.code === "BATHTUB");
  const toilets = bathroom.filter((item) => item.code === "TOILET");
  assert.ok(tub);
  assert.equal(toilets.length, 2);
  assert.ok(toilets.every((toilet) => toilet.y < tub.y));
  assert.equal(bathroom.some((item) => item.code === "WINE_CABINET" || item.code?.includes("PLANT")), false);
});

test("rooms fill the traced outline instead of a rectangle around it", () => {
  const territory = [
    { x: 0, y: 0 },
    { x: 600, y: 0 },
    { x: 600, y: 180 },
    { x: 920, y: 180 },
    { x: 920, y: 520 },
    { x: 280, y: 520 },
    { x: 280, y: 320 },
    { x: 0, y: 320 },
  ];
  const requests = splitRoomRequests(
    "a living room with a sofa and a television, a kitchen with a table and 4 chairs, a bathroom with a toilet and a bathtub",
  );
  const plan = composeRoomFrames(requests, { polygon: territory });
  assert.ok(plan);
  assert.equal(plan.rooms.length, 3);
  assert.ok(plan.rooms.every((room) => room.polygon && room.polygon.length >= 4));

  const xs = [...new Set(territory.map((point) => point.x))].sort((a, b) => a - b);
  const ys = [...new Set(territory.map((point) => point.y))].sort((a, b) => a - b);
  let covered = 0;
  for (let col = 0; col < xs.length - 1; col += 1) {
    for (let row = 0; row < ys.length - 1; row += 1) {
      const center = { x: (xs[col] + xs[col + 1]) / 2, y: (ys[row] + ys[row + 1]) / 2 };
      if (!isPointInPolygon(center, territory, true)) continue;
      assert.equal(plan.rooms.filter((room) => isPointInPolygon(center, room.polygon ?? [], true)).length, 1);
      covered += 1;
    }
  }
  assert.ok(covered >= 4);
  const roomArea = plan.rooms.reduce((sum, room) => sum + polygonArea(room.polygon ?? []), 0);
  assert.ok(Math.abs(roomArea - polygonArea(territory)) < 1);

  const living = plan.rooms[0];
  const furniture = arrangeRoomFurniture({
    pieces: requests[0].pieces,
    roomType: requests[0].roomType,
    rect: plan.framed[0].rect,
    roomId: living.id,
    idPrefix: living.id,
  });
  for (const item of furniture) {
    const corners = [
      { x: item.x, y: item.y },
      { x: item.x + item.width, y: item.y },
      { x: item.x, y: item.y + item.depth },
      { x: item.x + item.width, y: item.y + item.depth },
    ];
    assert.ok(corners.every((corner) => isPointInPolygon(corner, living.polygon ?? [], true)));
  }
});
