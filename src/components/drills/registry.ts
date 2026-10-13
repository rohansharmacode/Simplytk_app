import type { ComponentType } from 'react';

import { FastFractionsDrill } from './fast-fractions';
import { MentalMathsDrill } from './mental-maths';

/** The drills played natively. Each also needs `native: true` in src/lib/drills/catalogue.ts. */
export const NATIVE_DRILLS: Record<string, ComponentType> = {
  'mental-maths': MentalMathsDrill,
  'fast-fractions': FastFractionsDrill,
};
