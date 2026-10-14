// Only historical D018/D047 comparisons use these preserved D007 recipes.
// Current D056 geometry is separately checked against the main baseline and new golden.
import { BRITISH_CIVIC } from '../src/content/britishCivic.ts';
import { KIND_SHAPES } from '../src/content/kindShapes.ts';
export const D056_LEGACY = Object.fromEntries(BRITISH_CIVIC.map(({k}) => [k, KIND_SHAPES[k]]));
