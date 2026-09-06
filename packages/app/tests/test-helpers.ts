import type { JavaDetector } from '../src/main/services/java-detector';

export function createFakeJavaDetector(): JavaDetector {
  const installation = {
    path: 'java',
    version: '21.0.0',
    majorVersion: 21,
    isValid: true,
  };

  return {
    detectAll: async () => [installation],
    selectForMinecraft: async () => installation,
    validateForMinecraft: async (javaPath: string) => ({
      installation: { ...installation, path: javaPath },
      requiredMajor: 21,
      compatible: true,
      reason: 'test Java',
    }),
  } as unknown as JavaDetector;
}
