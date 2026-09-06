import { describe, expect, it } from 'vitest';
import type { OnboardingStepId } from '../src/shared/ipc-types';
import { findNextOnboardingStep } from '../src/renderer/src/lib/onboarding';

type State = 'completed' | 'blocked' | 'recommended' | 'ready';

function statuses(overrides: Partial<Record<OnboardingStepId, State>> = {}) {
  const defaults: Record<OnboardingStepId, { state: State }> = {
    'review-folder-core': { state: 'ready' },
    'review-memory-java': { state: 'ready' },
    'start-server': { state: 'ready' },
    'review-properties': { state: 'blocked' },
    'review-connection': { state: 'blocked' },
    'create-backup': { state: 'ready' },
  };
  for (const [stepId, state] of Object.entries(overrides)) {
    defaults[stepId as OnboardingStepId] = { state };
  }
  return defaults;
}

describe('onboarding step prioritization', () => {
  it('uses the explicitly recommended actionable step', () => {
    expect(findNextOnboardingStep(statuses({ 'review-folder-core': 'completed', 'start-server': 'recommended' }))).toBe('start-server');
  });

  it('skips blocked steps and selects the next ready action', () => {
    expect(findNextOnboardingStep(statuses({
      'review-folder-core': 'completed',
      'review-memory-java': 'blocked',
    }))).toBe('start-server');
  });

  it('falls back to the first blocked dependency when nothing is actionable', () => {
    expect(findNextOnboardingStep(statuses({
      'review-folder-core': 'completed',
      'review-memory-java': 'blocked',
      'start-server': 'blocked',
      'create-backup': 'blocked',
    }))).toBe('review-memory-java');
  });
});
