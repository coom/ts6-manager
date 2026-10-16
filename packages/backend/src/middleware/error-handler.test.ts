import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import multer from 'multer';
import { errorHandler, AppError } from './error-handler.js';
import type { Request, Response } from 'express';

function run(err: Error) {
  const status = vi.fn().mockReturnThis();
  const json = vi.fn();
  const res = { status, json } as unknown as Response;
  errorHandler(err, {} as Request, res, vi.fn());
  return { status, json };
}

describe('errorHandler', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('maps multer LIMIT_FILE_SIZE to 413', () => {
    const err = new multer.MulterError('LIMIT_FILE_SIZE');
    const { status, json } = run(err);
    expect(status).toHaveBeenCalledWith(413);
    expect(json).toHaveBeenCalledWith({ error: err.message });
  });

  it('maps other multer codes to 400', () => {
    const err = new multer.MulterError('LIMIT_UNEXPECTED_FILE', 'file');
    const { status, json } = run(err);
    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({ error: err.message });
  });

  it('keeps the AppError status and message (fileFilter rejection)', () => {
    const { status, json } = run(new AppError(400, 'Unsupported file type: .exe'));
    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({ error: 'Unsupported file type: .exe', details: undefined });
  });

  it('hides unknown errors behind a generic 500', () => {
    const { status, json } = run(new Error('boom'));
    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({ error: 'Internal server error' });
  });
});
