import { createContext, useContext } from 'react';
import type { TheryTourApi } from './thery-tour.types';

export const TheryTourContext = createContext<TheryTourApi | null>(null);

export function useTheryTourOptional(): TheryTourApi | null {
  return useContext(TheryTourContext);
}
