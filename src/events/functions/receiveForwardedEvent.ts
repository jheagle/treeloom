/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { getItemById } from '../../domItem/tree/itemIdIndex'
import type { DomItem, DomItemRoot } from '../../domItem/types'
import { isFormControl } from './makeForwardingListener'
import type { ForwardedEvent } from '../types'

/**
 * Decides whether a resolved, incoming envelope may actually be dispatched. See receiveForwardedEvent's own
 * validator parameter - an id only makes resolution correct, not authorized, so anything that needs to check
 * who an id actually belongs to (not just that it resolves to a real item) plugs in here.
 */
export type ForwardedEventValidator = (resolvedItem: DomItem, envelope: ForwardedEvent) => boolean

/**
 * Replay an envelope's targetState onto the element it resolved to - only what captureTargetState (the sending
 * end) ever puts there: a string `value` or a boolean `checked`, and only onto a form control. The envelope comes
 * from another machine (a browser, for a server), so it can hold anything; copying every key across (as this once
 * did with Object.assign) let a hand-built envelope set any property on the receiving element: its methods, its
 * `innerHTML`, or its prototype through a JSON `__proto__` key.
 * @param element
 * @param targetState
 */
const applyTargetState = (element: HTMLElement & Partial<HTMLInputElement>, targetState: unknown): void => {
  if (typeof targetState !== 'object' || targetState === null || !isFormControl(element)) {
    return
  }
  const { value, checked } = targetState as Record<string, unknown>
  if (typeof value === 'string') {
    element.value = value
  }
  if (typeof checked === 'boolean') {
    element.checked = checked
  }
}

/**
 * The receiving end of makeForwardingListener's envelope: resolve the item it was built for, replay any live target
 * state it carried onto that item's real element (see applyTargetState and makeForwardingListener's
 * captureTargetState), then dispatch
 * a real event of the same type on it. The resolved item's own, already-bound listener runs exactly as it would for
 * a genuine local event - nothing here needs to know what that listener does.
 * @param root - The tree to resolve the envelope's itemId against. Its listeners must be the real ones (not
 * itself set up with setForwardEvents), or this would just forward the event again instead of running it.
 * @param envelope - As produced by makeForwardingListener on the sending end.
 * @param validator - Optional: when given and it returns false for the resolved item, the event is never
 * dispatched. Resolving by id is correct (it finds the right item even if this root's own tree shape differs
 * from the sender's), but not authorized on its own - a validator is the one place to plug an ownership check
 * in, instead of every caller re-deriving "resolve first, then check, then dispatch" by hand.
 */
const receiveForwardedEvent = (root: DomItemRoot, envelope: ForwardedEvent, validator?: ForwardedEventValidator): void => {
  const resolvedItem = getItemById(root, envelope.itemId)
  if (validator && !validator(resolvedItem, envelope)) {
    return
  }
  const element = resolvedItem.element as (HTMLElement & Partial<HTMLInputElement>) | null
  if (!element) {
    throw new Error('The resolved item has no element to dispatch the event on.')
  }
  applyTargetState(element, envelope.targetState)
  element.dispatchEvent(new Event(envelope.eventType, { bubbles: true, cancelable: true }))
}

export default receiveForwardedEvent
