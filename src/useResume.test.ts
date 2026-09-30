import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { documentSchema, sample } from './model';
import { loadResume, saveResume } from './storage';
import { useResume } from './useResume';

vi.mock('./storage', () => ({ loadResume: vi.fn(), saveResume: vi.fn() }));

let root: Root;
let state: ReturnType<typeof useResume>;

async function mount() {
  root = createRoot(document.body.appendChild(document.createElement('div')));
  function Probe() {
    state = useResume();
    return null;
  }
  await act(async () => root.render(createElement(Probe)));
}

async function elapsed(ms: number) {
  await act(async () => vi.advanceTimersByTimeAsync(ms));
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.mocked(loadResume).mockResolvedValue(documentSchema.parse(sample));
  vi.mocked(saveResume).mockResolvedValue(undefined);
});

afterEach(async () => {
  if (root) await act(async () => root.unmount());
  document.body.replaceChildren();
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.resetAllMocks();
  vi.unstubAllGlobals();
});

describe('本地保存与有限撤销历史', () => {
  it('读取失败后的普通编辑不写回存储，明确导入才恢复保存', async () => {
    vi.mocked(loadResume).mockRejectedValue(new Error('IndexedDB unavailable'));
    await mount();
    expect(state.status).toContain('读取失败');
    act(() => state.update((doc) => ({ ...doc, name: '临时编辑' })));
    await elapsed(2000);
    expect(saveResume).not.toHaveBeenCalled();
    const recovered = documentSchema.parse({ ...sample, name: '明确导入的备份' });
    act(() => state.update(recovered));
    await elapsed(500);
    expect(saveResume).toHaveBeenLastCalledWith(recovered);
    expect(state.status).toBe('已保存在此浏览器');
  });

  it('保存失败保留当前文档并提示备份，下一次编辑可重试', async () => {
    vi.mocked(saveResume).mockRejectedValueOnce(new Error('QuotaExceededError'));
    await mount();
    await elapsed(500);
    expect(state.status).toContain('保存失败');
    expect(state.doc).toEqual(sample);
    act(() => state.update((doc) => ({ ...doc, name: '仍可编辑和备份' })));
    await elapsed(500);
    expect(saveResume).toHaveBeenLastCalledWith(state.doc);
    expect(state.status).toBe('已保存在此浏览器');
  });

  it('超过 40 次编辑只能撤销最近 40 步，重做后新编辑清空重做分支', async () => {
    await mount();
    for (let i = 1; i <= 42; i++) act(() => state.update((doc) => ({ ...doc, name: `${i}` })));
    for (let i = 0; i < 40; i++) act(() => state.undo());
    expect(state.doc.name).toBe('2');
    expect(state.canUndo).toBe(false);
    act(() => state.undo());
    expect(state.doc.name).toBe('2');
    for (let i = 0; i < 40; i++) act(() => state.redo());
    expect(state.doc.name).toBe('42');
    expect(state.canRedo).toBe(false);
    act(() => state.undo());
    act(() => state.update((doc) => ({ ...doc, name: '新分支' })));
    expect(state.canRedo).toBe(false);
  });

  it('连续输入合并撤销，停顿后建立新的撤销步骤', async () => {
    await mount();
    act(() => state.update((doc) => ({ ...doc, name: '连续输入一' }), true));
    await elapsed(300);
    act(() => state.update((doc) => ({ ...doc, name: '连续输入二' }), true));
    await elapsed(651);
    act(() => state.update((doc) => ({ ...doc, name: '停顿后的输入' }), true));
    act(() => state.undo());
    expect(state.doc.name).toBe('连续输入二');
    act(() => state.undo());
    expect(state.doc).toEqual(sample);
  });
});
