// Java Version Parser Property-Based Tests
// Feature: lumix-launcher, Property 3: Java Version Parsing

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  parseJavaVersionOutput,
  extractMajorVersion,
  isValidVersionString,
} from '../src/services/java/java-version-parser';

// ============================================================================
// Arbitraries (資料生成器)
// ============================================================================

// 生成有效的 Java 8 版本字串 (1.8.x_xxx)
const java8VersionArb = fc
  .tuple(
    fc.integer({ min: 0, max: 400 }), // minor
    fc.integer({ min: 1, max: 999 })  // update
  )
  .map(([minor, update]) => `1.8.${minor}_${update}`);

// 生成有效的 Java 9+ 版本字串 (x.y.z)
const modernJavaVersionArb = fc
  .tuple(
    fc.integer({ min: 9, max: 25 }),  // major
    fc.integer({ min: 0, max: 20 }),  // minor
    fc.integer({ min: 0, max: 20 })   // patch
  )
  .map(([major, minor, patch]) => `${major}.${minor}.${patch}`);

// 生成 java -version 輸出格式
const javaVersionOutputArb = (versionArb: fc.Arbitrary<string>) =>
  fc.tuple(
    fc.constantFrom('openjdk', 'java'),
    versionArb
  ).map(([type, version]) => `${type} version "${version}"\nOpenJDK Runtime Environment`);

// ============================================================================
// Property Tests
// ============================================================================

describe('Java Version Parser', () => {
  describe('Property 3: Java Version Parsing', () => {
    it('should correctly parse Java 8 version strings (100 runs)', () => {
      fc.assert(
        fc.property(java8VersionArb, (version) => {
          const output = `java version "${version}"\nJava(TM) SE Runtime Environment`;
          const result = parseJavaVersionOutput(output);

          expect(result).not.toBeNull();
          expect(result!.version).toBe(version);
          expect(result!.majorVersion).toBe(8);
        }),
        { numRuns: 100 }
      );
    });

    it('should correctly parse Java 9+ version strings (100 runs)', () => {
      fc.assert(
        fc.property(modernJavaVersionArb, (version) => {
          const output = `openjdk version "${version}"\nOpenJDK Runtime Environment`;
          const result = parseJavaVersionOutput(output);

          expect(result).not.toBeNull();
          expect(result!.version).toBe(version);
          
          // 主版本號應該是版本字串的第一個數字
          const expectedMajor = parseInt(version.split('.')[0], 10);
          expect(result!.majorVersion).toBe(expectedMajor);
        }),
        { numRuns: 100 }
      );
    });

    it('should extract correct major version from any valid version string (100 runs)', () => {
      const allVersionsArb = fc.oneof(java8VersionArb, modernJavaVersionArb);

      fc.assert(
        fc.property(allVersionsArb, (version) => {
          const majorVersion = extractMajorVersion(version);

          expect(majorVersion).not.toBeNull();
          expect(majorVersion).toBeGreaterThanOrEqual(8);
          expect(majorVersion).toBeLessThanOrEqual(25);
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Real-world Version Strings', () => {
    const realWorldVersions = [
      { output: 'openjdk version "17.0.2" 2022-01-18', expected: { version: '17.0.2', major: 17 } },
      { output: 'java version "1.8.0_301"', expected: { version: '1.8.0_301', major: 8 } },
      { output: 'openjdk version "21.0.1" 2023-10-17', expected: { version: '21.0.1', major: 21 } },
      { output: 'openjdk version "11.0.11" 2021-04-20', expected: { version: '11.0.11', major: 11 } },
    ];

    it.each(realWorldVersions)(
      'should parse: $output',
      ({ output, expected }) => {
        const result = parseJavaVersionOutput(output);

        expect(result).not.toBeNull();
        expect(result!.version).toBe(expected.version);
        expect(result!.majorVersion).toBe(expected.major);
      }
    );
  });

  describe('Invalid Inputs', () => {
    it('should return null for invalid version output', () => {
      const invalidOutputs = [
        '',
        'not a java version',
        'version without quotes',
        'java version 17.0.2', // missing quotes
      ];

      for (const output of invalidOutputs) {
        expect(parseJavaVersionOutput(output)).toBeNull();
      }
    });

    it('should return null for invalid version strings', () => {
      const invalidVersions = ['abc', '', 'x.y.z', '..'];

      for (const version of invalidVersions) {
        expect(extractMajorVersion(version)).toBeNull();
      }
    });
  });
});
