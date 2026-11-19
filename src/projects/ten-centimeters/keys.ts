// Keyboard shortcuts for the bay actions and the supply shelf (the same
// key picks up an item at Supply and uses it at a bay).
import type { Action, Item } from './sim/types'

export const ACTION_KEYS: Record<Action, string> = {
  pitocin: 'Z',
  epidural: 'X',
  magnesium: 'C',
  oxygen: 'V',
  reposition: 'B',
  deliver: 'Space',
  codeStork: 'Enter',
}

export const ITEM_KEYS: Record<Item, string> = { pitocin: 'Z', epidural: 'X', magnesium: 'C', oxygen: 'V' }
