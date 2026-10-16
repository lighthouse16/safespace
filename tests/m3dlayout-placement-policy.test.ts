import test from "node:test";
import assert from "node:assert/strict";
import { sceneToFurniture } from "../src/lib/m3dlayout/scene-adapter";
import { placeModelFurniture } from "../src/lib/m3dlayout/placement-policy";
import { furnitureToWorldFootprint } from "../src/lib/spatial/geometry/placement";
import { polygonIntersectsPolygon, isFootprintContainedInBoundary } from "../src/lib/spatial/geometry/intersections";

const frame = { roomId: "test-room", centerX: 250, centerY: 200, maxWidthCm: 500, maxDepthCm: 400 };

test("overlapping Colab boxes are separated or rejected, never accepted overlapping", () => {
  const input = sceneToFurniture({
    class_names: ["sofa", "coffee_table", "chair"],
    translations: [[0, 0, 0], [0, 0, 0], [0, 0, 0]],
    sizes: [[1.8, 0.8, 0.8], [0.8, 0.4, 0.5], [0.5, 0.9, 0.5]],
    angles: [0, 0, 0],
  }, frame);
  assert.equal(input.length, 3);
  assert.equal(new Set(input.map(f => f.x + f.width / 2)).size, 1, "model centers are preserved before validation");
  const result = placeModelFurniture(input, frame);
  assert.equal(result.furniture.length, 3);
  assert.equal(result.unplaced.length, 0);
  const boundary = [{x:8,y:8},{x:492,y:8},{x:492,y:392},{x:8,y:392}];
  for (let i = 0; i < result.furniture.length; i++) {
    const a = furnitureToWorldFootprint(result.furniture[i]).footprint;
    assert.equal(isFootprintContainedInBoundary(a,boundary), true);
    for (let j = i+1; j < result.furniture.length; j++) {
      const b = furnitureToWorldFootprint(result.furniture[j]).footprint;
      assert.equal(polygonIntersectsPolygon(a,b), false);
    }
  }
});

test("impossible Colab plan is rejected rather than squeezed or clipped", () => {
  const small = { roomId: "tiny", centerX: 100, centerY: 100, maxWidthCm: 200, maxDepthCm: 200 };
  const input = sceneToFurniture({
    class_names: ["bed", "bed"],
    translations: [[0,0,0],[0,0,0]],
    sizes: [[1.8,0.5,1.8],[1.8,0.5,1.8]],
    angles: [0,0],
  }, small);
  const result = placeModelFurniture(input, small);
  assert.ok(result.unplaced.length > 0);
});

test("different model translations produce different furniture positions", () => {
  const create = (x:number) => sceneToFurniture({
    class_names: ["sofa", "chair"],
    translations: [[0,0,0],[x,0,0]],
    sizes: [[1,1,1],[0.5,1,0.5]],
    angles: [0,0],
  }, frame);
  const near = create(1);
  const far = create(4);
  assert.notEqual(near[0].x, far[0].x);
});
