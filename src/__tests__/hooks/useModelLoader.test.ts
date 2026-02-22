import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Mock SDK modules before importing the hook
vi.mock('@runanywhere/web', () => import('../__mocks__/runanywhere-web'));
vi.mock('@runanywhere/web-llamacpp', () => import('../__mocks__/runanywhere-web-llamacpp'));
vi.mock('@runanywhere/web-onnx', () => import('../__mocks__/runanywhere-web-onnx'));

import { useModelLoader } from '../../hooks/useModelLoader';
import { ModelManager, ModelCategory, EventBus } from '@runanywhere/web';

describe('useModelLoader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (ModelManager as any)._reset();
    (EventBus.shared as any)._reset();
  });

  it('returns idle state when no model is loaded', () => {
    (ModelManager.getLoadedModel as any).mockReturnValue(null);
    const { result } = renderHook(() => useModelLoader(ModelCategory.Language));

    expect(result.current.state).toBe('idle');
    expect(result.current.progress).toBe(0);
    expect(result.current.error).toBeNull();
  });

  it('returns ready state when model is already loaded', () => {
    (ModelManager.getLoadedModel as any).mockReturnValue({ id: 'test-model' });
    const { result } = renderHook(() => useModelLoader(ModelCategory.Language));

    expect(result.current.state).toBe('ready');
  });

  it('ensure() returns true immediately if model already loaded', async () => {
    (ModelManager.getLoadedModel as any).mockReturnValue({ id: 'test-model' });
    const { result } = renderHook(() => useModelLoader(ModelCategory.Language));

    let ok: boolean = false;
    await act(async () => {
      ok = await result.current.ensure();
    });

    expect(ok).toBe(true);
    expect(result.current.state).toBe('ready');
  });

  it('ensure() returns error when no models registered for category', async () => {
    (ModelManager.getLoadedModel as any).mockReturnValue(null);
    (ModelManager.getModels as any).mockReturnValue([]);

    const { result } = renderHook(() => useModelLoader(ModelCategory.Language));

    let ok: boolean = true;
    await act(async () => {
      ok = await result.current.ensure();
    });

    expect(ok).toBe(false);
    expect(result.current.state).toBe('error');
    expect(result.current.error).toContain('No');
  });

  it('ensure() downloads and loads a model successfully', async () => {
    (ModelManager.getLoadedModel as any).mockReturnValue(null);
    (ModelManager.getModels as any).mockReturnValue([
      { id: 'test-model', modality: ModelCategory.Language, status: 'registered' },
    ]);
    (ModelManager.downloadModel as any).mockResolvedValue(undefined);
    (ModelManager.loadModel as any).mockResolvedValue(true);

    const { result } = renderHook(() => useModelLoader(ModelCategory.Language));

    let ok: boolean = false;
    await act(async () => {
      ok = await result.current.ensure();
    });

    expect(ok).toBe(true);
    expect(result.current.state).toBe('ready');
    expect(ModelManager.downloadModel).toHaveBeenCalledWith('test-model');
    expect(ModelManager.loadModel).toHaveBeenCalledWith('test-model', { coexist: false });
  });

  it('skips download if model already downloaded', async () => {
    (ModelManager.getLoadedModel as any).mockReturnValue(null);
    (ModelManager.getModels as any).mockReturnValue([
      { id: 'test-model', modality: ModelCategory.Language, status: 'downloaded' },
    ]);
    (ModelManager.loadModel as any).mockResolvedValue(true);

    const { result } = renderHook(() => useModelLoader(ModelCategory.Language));

    await act(async () => {
      await result.current.ensure();
    });

    expect(ModelManager.downloadModel).not.toHaveBeenCalled();
    expect(ModelManager.loadModel).toHaveBeenCalled();
  });

  it('handles loadModel returning false', async () => {
    (ModelManager.getLoadedModel as any).mockReturnValue(null);
    (ModelManager.getModels as any).mockReturnValue([
      { id: 'test-model', modality: ModelCategory.Language, status: 'downloaded' },
    ]);
    (ModelManager.loadModel as any).mockResolvedValue(false);

    const { result } = renderHook(() => useModelLoader(ModelCategory.Language));

    let ok: boolean = true;
    await act(async () => {
      ok = await result.current.ensure();
    });

    expect(ok).toBe(false);
    expect(result.current.state).toBe('error');
    expect(result.current.error).toBe('Failed to load model');
  });

  it('handles download exceptions', async () => {
    (ModelManager.getLoadedModel as any).mockReturnValue(null);
    (ModelManager.getModels as any).mockReturnValue([
      { id: 'test-model', modality: ModelCategory.Language, status: 'registered' },
    ]);
    (ModelManager.downloadModel as any).mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useModelLoader(ModelCategory.Language));

    let ok: boolean = true;
    await act(async () => {
      ok = await result.current.ensure();
    });

    expect(ok).toBe(false);
    expect(result.current.state).toBe('error');
    expect(result.current.error).toBe('Network error');
  });

  it('passes coexist option to loadModel', async () => {
    (ModelManager.getLoadedModel as any).mockReturnValue(null);
    (ModelManager.getModels as any).mockReturnValue([
      { id: 'test-model', modality: ModelCategory.SpeechRecognition, status: 'downloaded' },
    ]);
    (ModelManager.loadModel as any).mockResolvedValue(true);

    const { result } = renderHook(() =>
      useModelLoader(ModelCategory.SpeechRecognition, true),
    );

    await act(async () => {
      await result.current.ensure();
    });

    expect(ModelManager.loadModel).toHaveBeenCalledWith('test-model', { coexist: true });
  });

  it('prevents concurrent ensure() calls', async () => {
    (ModelManager.getLoadedModel as any).mockReturnValue(null);
    (ModelManager.getModels as any).mockReturnValue([
      { id: 'test-model', modality: ModelCategory.Language, status: 'downloaded' },
    ]);

    let loadModelResolve: (v: boolean) => void;
    (ModelManager.loadModel as any).mockImplementation(
      () => new Promise<boolean>((r) => { loadModelResolve = r; }),
    );

    const { result } = renderHook(() => useModelLoader(ModelCategory.Language));

    let p1: Promise<boolean>;
    let p2: Promise<boolean>;

    await act(async () => {
      p1 = result.current.ensure();
      p2 = result.current.ensure();
    });

    // Second call should return false immediately (guard)
    expect(await p2!).toBe(false);

    // Resolve first call
    await act(async () => {
      loadModelResolve!(true);
      await p1!;
    });

    expect(ModelManager.loadModel).toHaveBeenCalledTimes(1);
  });

  it('handles non-Error exception objects', async () => {
    (ModelManager.getLoadedModel as any).mockReturnValue(null);
    (ModelManager.getModels as any).mockReturnValue([
      { id: 'test-model', modality: ModelCategory.Language, status: 'registered' },
    ]);
    (ModelManager.downloadModel as any).mockRejectedValue('string error');

    const { result } = renderHook(() => useModelLoader(ModelCategory.Language));

    await act(async () => {
      await result.current.ensure();
    });

    expect(result.current.error).toBe('string error');
  });
});
