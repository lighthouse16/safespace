/**
 * Furniture words the autoregressive model can emit.
 * Source: DATASET_STATS_AR.class_labels in M3DLayout gradio_demo.py, without the
 * autoregressive "start" and "end" tokens.
 */
export const M3D_CLASS_LABELS = [
  "appliances", "armchair", "balloon", "bathtub", "bed", "beverage_fridge", "book",
  "book_column", "book_stack", "bookshelf", "bottle", "bowl", "box", "cabinet", "can",
  "ceiling_lamp", "cell_shelf", "chair", "chaise_longue_sofa", "chest_of_drawers",
  "children_cabinet", "chinese_chair", "chopsticks", "clothes", "clutter", "coffee_table",
  "console_table", "corner_side_table", "counter", "cup", "curtain", "cushion", "decoration",
  "desk", "desk_lamp", "dining_chair", "dining_table", "dishwasher", "dressing_chair",
  "dressing_table", "floor_lamp", "food_bag", "food_box", "fork", "fruit_container",
  "glass_panel_door", "hardware", "jar", "kids_bed", "kitchen_cabinet", "kitchen_space",
  "knife", "l_shaped_sofa", "large_plant_container", "large_shelf", "lazy_sofa", "lighting",
  "lite_door", "lounge_chair", "louver_door", "loveseat_sofa", "microwave", "mirror",
  "monitor", "multi_seat_sofa", "nature_shelf_trinkets", "nightstand", "oven", "pan",
  "panel_door", "pendant_lamp", "picture", "plant", "plant_container", "plate", "pot",
  "round_end_table", "rug", "seating", "shelf", "shelving", "shower", "side_table", "sink",
  "sofa", "spoon", "standing_sink", "stool", "table", "toilet", "towel", "trashcan", "tv",
  "tv_monitor", "tv_stand", "vase", "wall_art", "wardrobe", "window", "wine_cabinet",
  "wineglass",
] as const;

export type M3DClassLabel = (typeof M3D_CLASS_LABELS)[number];

const CLASS_SET = new Set<string>(M3D_CLASS_LABELS);

export function isM3DClassLabel(value: string): value is M3DClassLabel {
  return CLASS_SET.has(value);
}

/** Everyday phrases, longest-first at runtime, mapped onto class labels. */
export const FURNITURE_ALIASES: ReadonlyArray<{ phrase: string; className: M3DClassLabel }> = [
  { phrase: "entertainment center", className: "tv_stand" },
  { phrase: "entertainment unit", className: "tv_stand" },
  { phrase: "chest of drawers", className: "chest_of_drawers" },
  { phrase: "television stand", className: "tv_stand" },
  { phrase: "sectional sofa", className: "l_shaped_sofa" },
  { phrase: "l-shaped sofa", className: "l_shaped_sofa" },
  { phrase: "l shaped sofa", className: "l_shaped_sofa" },
  { phrase: "chaise longue", className: "chaise_longue_sofa" },
  { phrase: "three-seater", className: "multi_seat_sofa" },
  { phrase: "three seater", className: "multi_seat_sofa" },
  { phrase: "bedside table", className: "nightstand" },
  { phrase: "coffee table", className: "coffee_table" },
  { phrase: "countertop", className: "counter" },
  { phrase: "counter top", className: "counter" },
  { phrase: "hot tub", className: "bathtub" },
  { phrase: "hottub", className: "bathtub" },
  { phrase: "cupboard", className: "cabinet" },
  { phrase: "dining table", className: "dining_table" },
  { phrase: "dining chair", className: "dining_chair" },
  { phrase: "console table", className: "console_table" },
  { phrase: "dressing table", className: "dressing_table" },
  { phrase: "side table", className: "side_table" },
  { phrase: "end table", className: "round_end_table" },
  { phrase: "floor lamp", className: "floor_lamp" },
  { phrase: "desk lamp", className: "desk_lamp" },
  { phrase: "ceiling lamp", className: "ceiling_lamp" },
  { phrase: "lounge chair", className: "lounge_chair" },
  { phrase: "office chair", className: "chair" },
  { phrase: "arm chair", className: "armchair" },
  { phrase: "love seat", className: "loveseat_sofa" },
  { phrase: "tv stand", className: "tv_stand" },
  { phrase: "book case", className: "bookshelf" },
  { phrase: "trash can", className: "trashcan" },
  { phrase: "night stand", className: "nightstand" },
  { phrase: "flat-screen", className: "tv" },
  { phrase: "flat screen", className: "tv" },
  { phrase: "bookshelves", className: "bookshelf" },
  { phrase: "bookcases", className: "bookshelf" },
  { phrase: "television", className: "tv" },
  { phrase: "bookshelf", className: "bookshelf" },
  { phrase: "bookcase", className: "bookshelf" },
  { phrase: "nightstand", className: "nightstand" },
  { phrase: "loveseat", className: "loveseat_sofa" },
  { phrase: "armchair", className: "armchair" },
  { phrase: "wardrobe", className: "wardrobe" },
  { phrase: "dresser", className: "chest_of_drawers" },
  { phrase: "cabinet", className: "cabinet" },
  { phrase: "ottoman", className: "stool" },
  { phrase: "bathtub", className: "bathtub" },
  { phrase: "bath tub", className: "bathtub" },
  { phrase: "shower", className: "shower" },
  { phrase: "mirror", className: "mirror" },
  { phrase: "curtain", className: "curtain" },
  { phrase: "closet", className: "wardrobe" },
  { phrase: "window", className: "window" },
  { phrase: "door", className: "panel_door" },
  { phrase: "carpet", className: "rug" },
  { phrase: "pillow", className: "cushion" },
  { phrase: "cushion", className: "cushion" },
  { phrase: "picture", className: "picture" },
  { phrase: "painting", className: "wall_art" },
  { phrase: "monitor", className: "monitor" },
  { phrase: "fridge", className: "beverage_fridge" },
  { phrase: "refrigerator", className: "beverage_fridge" },
  { phrase: "microwave", className: "microwave" },
  { phrase: "dishwasher", className: "dishwasher" },
  { phrase: "toilet", className: "toilet" },
  { phrase: "plant", className: "plant" },
  { phrase: "shelf", className: "shelf" },
  { phrase: "couch", className: "sofa" },
  { phrase: "sofa", className: "sofa" },
  { phrase: "chair", className: "chair" },
  { phrase: "stool", className: "stool" },
  { phrase: "bench", className: "seating" },
  { phrase: "table", className: "table" },
  { phrase: "desk", className: "desk" },
  { phrase: "lamp", className: "floor_lamp" },
  { phrase: "vanity", className: "dressing_table" },
  { phrase: "rug", className: "rug" },
  { phrase: "bed", className: "bed" },
  { phrase: "sink", className: "sink" },
  { phrase: "oven", className: "oven" },
  { phrase: "bin", className: "trashcan" },
  { phrase: "tv", className: "tv" },
];

const PROMPT_NAMES: Partial<Record<M3DClassLabel, string>> = {
  coffee_table: "coffee table",
  tv_stand: "television stand",
  tv: "television",
  tv_monitor: "television",
  l_shaped_sofa: "sectional sofa",
  loveseat_sofa: "loveseat",
  multi_seat_sofa: "sofa",
  chaise_longue_sofa: "chaise sofa",
  lazy_sofa: "sofa",
  dining_table: "dining table",
  dining_chair: "dining chair",
  chest_of_drawers: "dresser",
  floor_lamp: "floor lamp",
  desk_lamp: "desk lamp",
  ceiling_lamp: "ceiling lamp",
  pendant_lamp: "pendant lamp",
  round_end_table: "end table",
  side_table: "side table",
  console_table: "console table",
  corner_side_table: "corner table",
  dressing_table: "dressing table",
  lounge_chair: "lounge chair",
  kitchen_cabinet: "kitchen cabinet",
  beverage_fridge: "refrigerator",
  wall_art: "painting",
  kids_bed: "bed",
  large_plant_container: "plant",
  plant_container: "plant",
};

export function promptNameForClass(className: string): string {
  if (isM3DClassLabel(className) && PROMPT_NAMES[className]) {
    return PROMPT_NAMES[className] as string;
  }
  return className.replace(/_/g, " ");
}

export function titleNameForClass(className: string): string {
  return promptNameForClass(className).replace(/\b\w/g, (letter) => letter.toUpperCase());
}
