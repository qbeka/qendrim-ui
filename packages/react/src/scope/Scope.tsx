'use client';

import { createContext, forwardRef, useContext, useMemo, type HTMLAttributes } from 'react';

export type Recipe = 'studio' | 'editorial';
export type Theme = 'light' | 'dark';

interface ScopeValue {
  recipe?: Recipe | undefined;
  theme?: Theme | undefined;
}

const ScopeContext = createContext<ScopeValue>({});

/**
 * The attributes a portaled popup needs. A popup renders under <body>, outside the
 * scoped element, so it would miss the recipe's tokens without these.
 */
export function useScopeAttributes() {
  const { recipe, theme } = useContext(ScopeContext);
  return { 'data-q-recipe': recipe, 'data-q-theme': theme };
}

export interface ScopeProps extends HTMLAttributes<HTMLDivElement> {
  recipe?: Recipe;
  theme?: Theme;
}

/**
 * Applies a recipe to part of a page. You do not need this if the whole app uses one
 * recipe: put `data-q-recipe` on <html> instead and popups inherit it.
 */
export const Scope = forwardRef<HTMLDivElement, ScopeProps>(function Scope({ recipe, theme, ...rest }, ref) {
  const value = useMemo(() => ({ recipe, theme }), [recipe, theme]);
  return (
    <ScopeContext.Provider value={value}>
      <div {...rest} ref={ref} data-q-recipe={recipe} data-q-theme={theme} />
    </ScopeContext.Provider>
  );
});
