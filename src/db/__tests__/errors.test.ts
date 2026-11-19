import { describe, expect, it } from 'vitest';
import { classifyDbError, DbError, DB_ERROR_MESSAGES, guardDb } from '../errors';

/**
 * تست‌های مدیریت خطای IndexedDB — تضمین می‌کنیم هر نوع خطا به پیام فارسی
 * درست و رفتار قابل‌انتظار (retryable) تبدیل شود.
 */
describe('تبدیل خطای دیتابیس به پیام کاربرپسند', () => {
  it.each([
    ['QuotaExceededError', 'The quota has been exceeded.', 'QUOTA_EXCEEDED'],
    ['UnknownError', 'The operation was blocked by another connection', 'BLOCKED'],
    ['VersionError', 'The requested version is lower than the existing version.', 'VERSION_CONFLICT'],
    ['InvalidStateError', 'IndexedDB is not available', 'UNAVAILABLE'],
    ['NotFoundError', 'Record not found', 'NOT_FOUND'],
    ['WhateverError', 'something odd', 'UNKNOWN'],
  ])('%s ⇒ %s', (name, message, expectedKind) => {
    const error = Object.assign(new Error(message), { name });
    const classification = classifyDbError(error);
    expect(classification.kind).toBe(expectedKind);
    expect(classification.userMessage).toBe(DB_ERROR_MESSAGES[expectedKind as keyof typeof DB_ERROR_MESSAGES]);
    // پیام فارسی باید غیرخالی و بدون متن انگلیسی خام باشد
    expect(classification.userMessage.length).toBeGreaterThan(10);
  });

  it('خطای QUOTA_EXCEEDED راهنمای حذف پروژه می‌دهد', () => {
    const classification = classifyDbError(new Error('QuotaExceededError: quota exceeded'));
    expect(classification.kind).toBe('QUOTA_EXCEEDED');
    expect(classification.userMessage).toContain('حافظه');
    expect(classification.retryable).toBe(false);
  });

  it('خطای BLOCKED قابل تلاش دوباره است', () => {
    const classification = classifyDbError(new Error('blocked by another tab'));
    expect(classification.kind).toBe('BLOCKED');
    expect(classification.retryable).toBe(true);
  });

  it('DbError موجود بدون تغییر برمی‌گردد', () => {
    const original = new DbError('NOT_FOUND', 'پروژه پیدا نشد');
    expect(classifyDbError(original)).toBe(original);
  });

  it('guardDb خطای خام را به DbError با نام عملیات تبدیل می‌کند', async () => {
    await expect(
      guardDb('ذخیرهٔ پروژه', async () => {
        throw Object.assign(new Error('The quota has been exceeded.'), { name: 'QuotaExceededError' });
      }),
    ).rejects.toMatchObject({ kind: 'QUOTA_EXCEEDED' });

    try {
      await guardDb('ذخیرهٔ پروژه', async () => {
        throw Object.assign(new Error('The quota has been exceeded.'), { name: 'QuotaExceededError' });
      });
    } catch (error) {
      expect(error).toBeInstanceOf(DbError);
      expect((error as DbError).message).toContain('ذخیرهٔ پروژه');
    }
  });

  it('guardDb نتیجهٔ موفق را بدون تغییر برمی‌گرداند', async () => {
    await expect(guardDb('خواندن', async () => 42)).resolves.toBe(42);
  });
});
