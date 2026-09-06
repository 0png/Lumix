import type { OnboardingStepId } from '../../../shared/ipc-types';

export const ONBOARDING_STEP_ORDER: OnboardingStepId[] = [
  'review-folder-core',
  'review-memory-java',
  'start-server',
  'review-properties',
  'review-connection',
  'create-backup',
];

export function findNextOnboardingStep(
  statuses: Record<OnboardingStepId, { state: 'completed' | 'blocked' | 'recommended' | 'ready' }>
): OnboardingStepId {
  return ONBOARDING_STEP_ORDER.find((stepId) => statuses[stepId].state === 'recommended')
    || ONBOARDING_STEP_ORDER.find((stepId) => statuses[stepId].state === 'ready')
    || ONBOARDING_STEP_ORDER.find((stepId) => statuses[stepId].state !== 'completed')
    || 'review-folder-core';
}
