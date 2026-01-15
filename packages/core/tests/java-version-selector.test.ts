// Java Version Selector Property-Based Tests
// Feature: lumix-launcher, Property 2: Java Version Selection Compatibility

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  getRequiredJavaVersion,
  selectJavaForMinecraft,
  isJavaCompatible,
  getRecommendedJavaVersions,
} from '../src/services/java/java-version-selector';
import type { JavaInstallation } from '../src/models/types';

// ============================================================================
// Arbitraries (資料生成器)
// ============================================================================

// MC 1.12.2-1.16.5 版本（需要 Java 8+）
const oldMcVersionArb = fc
  .tuple(
    fc.integer({ min: 12, max: 16 }),
    fc.integer({ min: 0, max: 5 })
  )
  .map(([minor, patch]) => `1.${minor}.${patch}`);

// MC 1.17-1.20.4 版本（需要 Java 17+）
const midMcVersionArb = fc.oneof(
  fc.tuple(
    fc.integer({ min: 17, max: 19 }),
    fc.integer({ min: 0, max: 4 })
  ).map(([minor, patch]) => `1.${minor}.${patch}`),
  fc.integer({ min: 0, max: 4 }).map((patch) => `1.20.${patch}`)
);

// MC 1.20.5+ 版本（需要 Java 21+）
const newMcVersionArb = fc.oneof(
  fc.integer({ min: 5, max: 10 }).map((patch) => `1.20.${patch}`),
  fc.tuple(
    fc.integer({ min: 21, max: 25 }),
    fc.integer({ min: 0, max: 5 })
  ).map(([minor, patch]) => `1.${minor}.${patch}`)
);

// 生成 JavaInstallation
const javaInstallationArb = (majorVersion: number): fc.Arbitrary<JavaInstallation> =>
  fc.record({
    path: fc.constant(`/path/to/java${majorVersion}`),
    version: fc.constant(`${majorVersion}.0.1`),
    majorVersion: fc.constant(majorVersion),
  });

// 生成多個 Java 安裝
const javaInstallationsArb = fc
  .subarray([8, 11, 17, 21] as const, { minLength: 1 })
  .chain((versions) =>
    fc.tuple(...versions.map((v) => javaInstallationArb(v)))
  );

// ============================================================================
// Property Tests
// ============================================================================

describe('Java Version Selector', () => {
  describe('Property 2: Java Version Selection Compatibility', () => {
    it('MC 1.12.2-1.16.5 should require Java 8+ (100 runs)', () => {
      fc.assert(
        fc.property(oldMcVersionArb, (mcVersion) => {
          const required = getRequiredJavaVersion(mcVersion);
          expect(required).toBe(8);
        }),
        { numRuns: 100 }
      );
    });

    it('MC 1.17-1.20.4 should require Java 17+ (100 runs)', () => {
      fc.assert(
        fc.property(midMcVersionArb, (mcVersion) => {
          const required = getRequiredJavaVersion(mcVersion);
          expect(required).toBe(17);
        }),
        { numRuns: 100 }
      );
    });

    it('MC 1.20.5+ should require Java 21+ (100 runs)', () => {
      fc.assert(
        fc.property(newMcVersionArb, (mcVersion) => {
          const required = getRequiredJavaVersion(mcVersion);
          expect(required).toBe(21);
        }),
        { numRuns: 100 }
      );
    });

    it('should select compatible Java from available installations (100 runs)', () => {
      fc.assert(
        fc.property(
          fc.oneof(oldMcVersionArb, midMcVersionArb, newMcVersionArb),
          javaInstallationsArb,
          (mcVersion, installations) => {
            const selected = selectJavaForMinecraft(mcVersion, installations);
            const required = getRequiredJavaVersion(mcVersion);

            if (selected) {
              // 選擇的 Java 版本必須 >= 需求版本
              expect(selected.majorVersion).toBeGreaterThanOrEqual(required);
              
              // 應該選擇最接近需求的版本
              const compatibleVersions = installations
                .filter((j) => j.majorVersion >= required)
                .map((j) => j.majorVersion);
              
              if (compatibleVersions.length > 0) {
                const minCompatible = Math.min(...compatibleVersions);
                expect(selected.majorVersion).toBe(minCompatible);
              }
            } else {
              // 如果沒有選擇，表示沒有相容的 Java
              const hasCompatible = installations.some(
                (j) => j.majorVersion >= required
              );
              expect(hasCompatible).toBe(false);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('isJavaCompatible', () => {
    it('should correctly determine compatibility', () => {
      // Java 8 與舊版 MC
      expect(isJavaCompatible(8, '1.12.2')).toBe(true);
      expect(isJavaCompatible(8, '1.16.5')).toBe(true);
      
      // Java 8 與新版 MC（不相容）
      expect(isJavaCompatible(8, '1.17')).toBe(false);
      expect(isJavaCompatible(8, '1.20.5')).toBe(false);
      
      // Java 17 與各版本
      expect(isJavaCompatible(17, '1.12.2')).toBe(true);
      expect(isJavaCompatible(17, '1.17')).toBe(true);
      expect(isJavaCompatible(17, '1.20.4')).toBe(true);
      expect(isJavaCompatible(17, '1.20.5')).toBe(false);
      
      // Java 21 與所有版本
      expect(isJavaCompatible(21, '1.12.2')).toBe(true);
      expect(isJavaCompatible(21, '1.20.5')).toBe(true);
      expect(isJavaCompatible(21, '1.21')).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should return null when no installations provided', () => {
      const result = selectJavaForMinecraft('1.20.4', []);
      expect(result).toBeNull();
    });

    it('should return null when no compatible Java available', () => {
      const java8Only: JavaInstallation[] = [
        { path: '/java8', version: '1.8.0_301', majorVersion: 8 },
      ];
      
      const result = selectJavaForMinecraft('1.20.5', java8Only);
      expect(result).toBeNull();
    });

    it('should handle invalid MC version gracefully', () => {
      // 無效版本應該回傳預設值 17
      expect(getRequiredJavaVersion('invalid')).toBe(17);
      expect(getRequiredJavaVersion('')).toBe(17);
    });
  });

  describe('getRecommendedJavaVersions', () => {
    it('should return recommended versions', () => {
      const versions = getRecommendedJavaVersions();
      
      expect(versions).toContain(8);
      expect(versions).toContain(17);
      expect(versions).toContain(21);
    });
  });
});
