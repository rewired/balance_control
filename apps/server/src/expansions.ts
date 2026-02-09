/* eslint-disable @typescript-eslint/no-explicit-any */
// Minimal local type to avoid depending on core internal paths
export type ExpansionModule = { id: string; version: string; requires?: string[]; register: (registry: any) => void };
import { economyExpansion } from '@bc/exp-economy';

export function loadAvailableExpansions(): ExpansionModule[] {
  const fakeEmpty: ExpansionModule = { id: 'dummy', version: '0.0.0', register: () => {} };
  const needsDep: ExpansionModule = { id: 'needsdep', version: '0.0.0', requires: ['dep'], register: () => {} };
  return [fakeEmpty, needsDep, economyExpansion];
}