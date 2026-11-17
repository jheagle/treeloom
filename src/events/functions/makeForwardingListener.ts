/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import type { DomItem } from '../../domItem/types'
import type { EventProxy, ForwardedEvent, ForwardEventsFunction, ListenerFunction } from '../types'

/** Form-control elements whose state a listener might read directly off the event target (see receiveForwardedEvent,
 * which only replays state onto these). */
export const FORM_CONTROL_TAGS = ['INPUT', 'SELECT', 'TEXTAREA']

/**
 * Whether an element is a form control (see FORM_CONTROL_TAGS), whatever case its tagName is in: browsers report
 * HTML tag names in upper case, but a DOM built some other way may not (pseudo-dom, used for a server-side tree,
 * keeps the case createElement was given, so 'input'). Comparing as-is let a checkbox's state be dropped on such a
 * receiver, so the listener there read it as unchecked.
 * @param element
 */
export const isFormControl = (element: { tagName?: unknown } | null | undefined): boolean =>
  typeof element?.tagName === 'string' && FORM_CONTROL_TAGS.includes(element.tagName.toUpperCase())

/**
 * Whatever live state a listener commonly reads directly off the real event's target - a checkbox's checked, an
 * input's value - captured here since the receiving end's corresponding element is otherwise an independent object
 * with no way to know what the user actually set. Omitted for anything that is not a form control (every element
 * has a non-undefined value or checked is not a safe enough check on its own - a plain button also has a value,
 * defaulting to '', and any input has checked defaulting to false even when it is not a checkbox).
 * @param target
 */
const captureTargetState = (target: EventTarget | null): ForwardedEvent['targetState'] => {
  const element = target as { tagName: string, type?: string, checked?: boolean, value?: string } | null
  if (!element || !isFormControl(element)) {
    return undefined
  }
  return element.type === 'checkbox' || element.type === 'radio'
    ? { checked: element.checked }
    : { value: element.value }
}

/**
 * Build the listener function used in render-only mode: instead of running real logic locally, it packages the
 * event as a plain envelope (the id of the item it fired on, the event type, the registered listener name, any
 * custom args, and any live target state - see captureTargetState) and hands it to the injected transport
 * function. See retrieveListener.
 * @param listenerName - The registered name this forwarder stands in for.
 * @param transport - Where the envelope is sent (set on the root item with setForwardEvents).
 */
const makeForwardingListener = (listenerName: string, transport: ForwardEventsFunction): ListenerFunction => (
  event: Event | EventProxy, item: DomItem, ...args: unknown[]
): unknown => transport({
  itemId: ((event as EventProxy).domItemTarget ?? item).id,
  eventType: event.type,
  listenerFunc: listenerName,
  data: args,
  targetState: captureTargetState(event.target)
})

export default makeForwardingListener
