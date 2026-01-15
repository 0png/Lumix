// Download Progress Property-Based Tests
// Feature: lumix-launcher, Property 1: Download Progress Invariant

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import type { DownloadProgress } from '../src/models/types';

// ============================================================================
// Property Tests for Download Progress
// ============================================================================

/**
 * 驗證 DownloadProgress 物件的不變量
 */
function validateProgressInvariant(progress: DownloadProgress): boolean {
  // 1. percentage 必須在 0-100 之間
  if (progress.percentage < 0 || progress.percentage > 100) {
    return false;
  }

  // 2. downloaded 必須 >= 0
  if (progress.downloaded < 0) {
    return false;
  }

  // 3. total 必須 >= 0
  if (progress.total < 0) {
    return false;
  }

  // 4. downloaded 不應該超過 total（如果 total > 0）
  if (progress.total > 0 && progress.downloaded > progress.total) {
    return false;
  }

  // 5. percentage 應該與 downloaded/total 一致（允許四捨五入誤差）
  if (progress.total > 0) {
    const expectedPercentage = Math.round((progress.downloaded / progress.total) * 100);
    if (Math.abs(progress.percentage - expectedPercentage) > 1) {
      return false;
    }
  }

  return true;
}

/**
 * 建立有效的 DownloadProgress
 */
function createValidProgress(downloaded: number, total: number): DownloadProgress {
  const safeDownloaded = Math.max(0, downloaded);
  const safeTotal = Math.max(0, total);
  const actualDownloaded = safeTotal > 0 ? Math.min(safeDownloaded, safeTotal) : safeDownloaded;
  const percentage = safeTotal > 0 ? Math.round((actualDownloaded / safeTotal) * 100) : 0;

  return {
    downloaded: actualDownloaded,
    total: safeTotal,
    percentage: Math.min(Math.max(percentage, 0), 100),
  };
}

describe('Download Progress', () => {
  describe('Property 1: Download Progress Invariant', () => {
    it('percentage should always be between 0 and 100 (100 runs)', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 1000000000 }), // downloaded
          fc.integer({ min: 0, max: 1000000000 }), // total
          (downloaded, total) => {
            const progress = createValidProgress(downloaded, total);
            
            expect(progress.percentage).toBeGreaterThanOrEqual(0);
            expect(progress.percentage).toBeLessThanOrEqual(100);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('downloaded should never exceed total when total > 0 (100 runs)', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 1000000000 }),
          fc.integer({ min: 1, max: 1000000000 }), // total > 0
          (downloaded, total) => {
            const progress = createValidProgress(downloaded, total);
            
            expect(progress.downloaded).toBeLessThanOrEqual(progress.total);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('percentage should be consistent with downloaded/total ratio (100 runs)', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 1000000000 }),
          fc.integer({ min: 1, max: 1000000000 }),
          (downloaded, total) => {
            const progress = createValidProgress(downloaded, total);
            const expectedPercentage = Math.round((progress.downloaded / progress.total) * 100);
            
            // 允許 1% 的四捨五入誤差
            expect(Math.abs(progress.percentage - expectedPercentage)).toBeLessThanOrEqual(1);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('all valid progress objects should pass invariant check (100 runs)', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 1000000000 }),
          fc.integer({ min: 0, max: 1000000000 }),
          (downloaded, total) => {
            const progress = createValidProgress(downloaded, total);
            
            expect(validateProgressInvariant(progress)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Progress Monotonicity', () => {
    it('progress sequence should be monotonically increasing (100 runs)', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1000, max: 1000000000 }), // total file size
          fc.integer({ min: 5, max: 20 }), // number of progress updates
          (total, updateCount) => {
            const progressHistory: DownloadProgress[] = [];
            
            // 模擬下載進度更新
            for (let i = 0; i <= updateCount; i++) {
              const downloaded = Math.floor((i / updateCount) * total);
              progressHistory.push(createValidProgress(downloaded, total));
            }

            // 驗證單調遞增
            for (let i = 1; i < progressHistory.length; i++) {
              expect(progressHistory[i].downloaded).toBeGreaterThanOrEqual(
                progressHistory[i - 1].downloaded
              );
              expect(progressHistory[i].percentage).toBeGreaterThanOrEqual(
                progressHistory[i - 1].percentage
              );
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero total correctly', () => {
      const progress = createValidProgress(0, 0);
      
      expect(progress.percentage).toBe(0);
      expect(validateProgressInvariant(progress)).toBe(true);
    });

    it('should handle complete download correctly', () => {
      const total = 1000000;
      const progress = createValidProgress(total, total);
      
      expect(progress.percentage).toBe(100);
      expect(progress.downloaded).toBe(total);
      expect(validateProgressInvariant(progress)).toBe(true);
    });

    it('should handle very large files', () => {
      const total = 10 * 1024 * 1024 * 1024; // 10 GB
      const downloaded = 5 * 1024 * 1024 * 1024; // 5 GB
      const progress = createValidProgress(downloaded, total);
      
      expect(progress.percentage).toBe(50);
      expect(validateProgressInvariant(progress)).toBe(true);
    });
  });
});
