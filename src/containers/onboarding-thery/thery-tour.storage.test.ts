/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it } from 'vitest';
import { readTourRecord, tourStorageKey, writeTourRecord } from './thery-tour.storage';

describe('thery-tour.storage', () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it('grava e lê o recorte por usuário e audiência', () => {
    writeTourRecord('u1', 'professional', {
      status: 'in_progress',
      stepIndex: 2,
      updatedAt: '2026-08-23T12:00:00.000Z',
    });
    expect(tourStorageKey('u1', 'professional')).toBe('unithery:thery-tour:u1:professional');
    expect(readTourRecord('u1', 'professional')).toEqual({
      status: 'in_progress',
      stepIndex: 2,
      updatedAt: '2026-08-23T12:00:00.000Z',
    });
    expect(readTourRecord('u1', 'patient')).toBeNull();
  });

  it('ignora JSON inválido', () => {
    window.localStorage.setItem(tourStorageKey('u2', 'patient'), '{broken');
    expect(readTourRecord('u2', 'patient')).toBeNull();
  });

  it('ignora objeto sem status válido', () => {
    window.localStorage.setItem(tourStorageKey('u3', 'caregiver'), JSON.stringify({ stepIndex: 0 }));
    expect(readTourRecord('u3', 'caregiver')).toBeNull();
  });
});
