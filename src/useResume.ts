import { useEffect, useRef, useState } from 'react';
import { sample, type Resume } from './model';
import { loadResume, saveResume } from './storage';

export function useResume() {
  const [doc, setDoc] = useState<Resume>(sample),
    [loaded, setLoaded] = useState(false),
    [status, setStatus] = useState('正在读取本地数据');
  const [storageHealthy, setStorageHealthy] = useState(true);
  const history = useRef<Resume[]>([]),
    future = useRef<Resume[]>([]),
    current = useRef(doc),
    lastEdit = useRef(0);
  useEffect(() => {
    let live = true;
    void loadResume()
      .then((saved) => {
        if (live && saved) {
          setDoc(saved);
          current.current = saved;
        }
      })
      .catch(() => {
        if (live) {
          setStorageHealthy(false);
          setStatus('读取失败：请导出备份或导入恢复');
        }
      })
      .finally(() => {
        if (live) setLoaded(true);
      });
    return () => {
      live = false;
    };
  }, []);
  useEffect(() => {
    if (!loaded || !storageHealthy) return;
    let live = true;
    setStatus('正在保存…');
    const timer = setTimeout(() => {
      void saveResume(doc)
        .then(() => {
          if (live) setStatus('已保存在此浏览器');
        })
        .catch(() => {
          if (live) setStatus('保存失败，请导出 JSON 备份');
        });
    }, 500);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [doc, loaded, storageHealthy]);
  const update = (next: Resume | ((prev: Resume) => Resume), groupTyping = false) => {
    if (!loaded) return;
    const value = typeof next === 'function' ? next(current.current) : next;
    // A validated import is an explicit recovery action; ordinary edits never overwrite a failed read.
    if (typeof next !== 'function' && !storageHealthy) setStorageHealthy(true);
    // Group contiguous typing into one undo step; retain bounded local history.
    if (!groupTyping || Date.now() - lastEdit.current > 650) {
      history.current.push(current.current);
      if (history.current.length > 40) history.current.shift();
    }
    lastEdit.current = groupTyping ? Date.now() : 0;
    future.current = [];
    current.current = value;
    setDoc(value);
  };
  const undo = () => {
    const prev = history.current.pop();
    if (prev) {
      future.current.push(current.current);
      current.current = prev;
      setDoc(prev);
      lastEdit.current = 0;
    }
  };
  const redo = () => {
    const next = future.current.pop();
    if (next) {
      history.current.push(current.current);
      current.current = next;
      setDoc(next);
      lastEdit.current = 0;
    }
  };
  return {
    doc,
    update,
    undo,
    redo,
    loaded,
    status,
    canUndo: history.current.length > 0,
    canRedo: future.current.length > 0,
  };
}
