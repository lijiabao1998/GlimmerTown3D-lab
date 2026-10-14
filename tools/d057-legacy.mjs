// Historical D056-and-earlier geometry, without weakening current D057 tests.
import { BRITISH_HERITAGE } from '../src/content/britishHeritage.ts';
import { KIND_SHAPES } from '../src/content/kindShapes.ts';
export const D057_LEGACY = Object.fromEntries(BRITISH_HERITAGE.map(({k}) => [k,KIND_SHAPES[k]]));
