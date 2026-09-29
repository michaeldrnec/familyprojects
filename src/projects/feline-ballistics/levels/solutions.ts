// Recorded solutions (SPEC.md section 9), found by the headless greedy
// solver and replayed by the QA harness after every physics change. They
// double as proof every level is winnable; star thresholds in the level
// files are tuned from these scores. Regenerate rather than hand-edit.
import type { Shot } from './types'

export const SOLUTIONS: Record<string, Shot[]> = {
  'kitchen-1': [{angle: -0.27, power: 0.95, actions: [{at: 0.5, kind: 'tap'}]}],
  'kitchen-2': [{angle: -0.63, power: 0.8, actions: []}],
  'kitchen-3': [{angle: -0.39, power: 0.8, actions: [{at: 0.5, kind: 'tap'}]}, {angle: -1.35, power: 0.95, actions: [{at: 0.5, kind: 'tap'}]}],
  'kitchen-4': [{angle: -0.63, power: 0.65, actions: [{at: 0.5, kind: 'tap'}]}, {angle: -0.75, power: 0.95, actions: []}],
  'kitchen-5': [{angle: -0.63, power: 0.8, actions: [{at: 0.5, kind: 'tap'}]}, {angle: -0.63, power: 0.8, actions: [{at: 1, kind: 'tap'}]}, {angle: -0.75, power: 0.8, actions: [{at: 0.5, kind: 'tap'}]}],
  'living-1': [{angle: -0.51, power: 0.95, actions: []}],
  'living-2': [{angle: -1.35, power: 0.8, actions: [{at: 0.5, kind: 'tap'}]}, {angle: -0.03, power: 0.8, actions: [{at: 0.5, kind: 'tap'}]}],
  'living-3': [{angle: -0.51, power: 0.95, actions: [{at: 1, kind: 'tap'}]}],
  'living-4': [{angle: -1.23, power: 0.95, actions: [{at: 1, kind: 'tap'}]}],
  'living-5': [{angle: -0.75, power: 0.95, actions: []}, {angle: -0.51, power: 0.95, actions: [{at: 1, kind: 'tap'}]}],
  'office-1': [{angle: -0.51, power: 0.8, actions: [{at: 1, kind: 'tap'}]}],
  'office-2': [{angle: -1.11, power: 0.8, actions: []}],
  'office-3': [{angle: -0.27, power: 0.65, actions: []}],
  'office-4': [{angle: -0.51, power: 0.8, actions: [{at: 1, kind: 'tap'}]}, {angle: -0.87, power: 0.8, actions: [{at: 1, kind: 'tap'}]}],
  'office-5': [{angle: -0.87, power: 0.65, actions: []}, {angle: -0.75, power: 0.95, actions: []}, {angle: -0.75, power: 0.95, actions: []}],
  'bedroom-1': [{angle: -0.51, power: 0.95, actions: [{at: 1, kind: 'tap'}]}],
  'bedroom-2': [{angle: -0.39, power: 0.95, actions: [{at: 1, kind: 'tap'}]}, {angle: -0.15, power: 0.95, actions: []}],
  'bedroom-3': [{angle: -0.87, power: 0.95, actions: []}, {angle: -1.11, power: 0.95, actions: [{at: 1, kind: 'tap'}]}],
  'bedroom-4': [{angle: -0.27, power: 0.95, actions: [{at: 0.5, kind: 'tap'}]}],
  'bedroom-5': [{angle: -0.39, power: 0.95, actions: [{at: 1, kind: 'tap'}]}, {angle: -0.63, power: 0.8, actions: []}],
}
