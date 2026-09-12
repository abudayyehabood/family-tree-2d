import { useCallback, useEffect, useMemo, useState } from 'react';

let seq = 0;
const nextId = () => `p${++seq}`;

const emptyTree = () => ({ people: {}, rootId: null });

const STORE = 'family-tree-v1';

/** The tree lives in this browser, so closing the page does not lose it. */
function loadTree() {
  try {
    const raw = localStorage.getItem(STORE);
    if (!raw) return emptyTree();
    const t = JSON.parse(raw);
    if (!t || typeof t.people !== 'object') return emptyTree();
    for (const id of Object.keys(t.people)) {
      const n = Number(String(id).replace(/^p/, ''));
      if (Number.isFinite(n) && n > seq) seq = n;      // never reuse an id
    }
    return { people: t.people, rootId: t.rootId ?? null };
  } catch {
    return emptyTree();
  }
}

const makePerson = (fields, extra) => ({
  id: extra.id,
  name: (fields.name || '').trim() || 'بدون اسم',
  gender: fields.gender || 'm',
  born: fields.born ?? null,
  photo: null,
  parentId: null,
  motherId: null,
  spouseOf: null,
  ...extra,
});

/**
 * One person at a time. The first name planted is the oldest ancestor and
 * carries the whole crown; everyone after that is somebody's child or spouse.
 */
export function useFamilyTree() {
  const [tree, setTree] = useState(loadTree);
  const [saved, setSaved] = useState({ at: null, failed: false });

  // every single change is written straight back to this browser
  useEffect(() => {
    try {
      localStorage.setItem(STORE, JSON.stringify(tree));
      setSaved({ at: Date.now(), failed: false });
    } catch {
      setSaved({ at: null, failed: true });      // private mode, or disk full
    }
  }, [tree]);

  /** Plant the oldest ancestor, or rename him later. */
  const setRoot = useCallback((fields) => {
    setTree((t) => {
      if (t.rootId) {
        const p = t.people[t.rootId];
        return { ...t, people: { ...t.people, [p.id]: { ...p, ...fields } } };
      }
      const id = nextId();
      return { rootId: id, people: { ...t.people, [id]: makePerson(fields, { id }) } };
    });
  }, []);

  /**
   * Children hang off the branch, so a child added while a wife is selected is
   * hung on her husband's branch and remembers which wife is the mother.
   */
  const addChild = useCallback((parentId, fields = {}) => {
    const id = nextId();
    setTree((t) => {
      const chosen = t.people[parentId];
      if (!chosen) return t;
      const father = chosen.spouseOf || parentId;
      const motherId = chosen.spouseOf ? parentId : null;
      return {
        ...t,
        people: { ...t.people, [id]: makePerson(fields, { id, parentId: father, motherId }) },
      };
    });
    return id;
  }, []);

  /**
   * A generation older than anything on the tree. The new man becomes the root
   * and the old root becomes his son, so the whole crown rises by one.
   */
  const addAncestor = useCallback((fields = {}) => {
    const id = nextId();
    setTree((t) => {
      if (!t.rootId) return t;
      const old = t.people[t.rootId];
      return {
        rootId: id,
        people: {
          ...t.people,
          [old.id]: { ...old, parentId: id, motherId: null },
          [id]: makePerson({ ...fields, gender: 'm' }, { id }),
        },
      };
    });
    return id;
  }, []);

  const addSpouse = useCallback((personId, fields = {}) => {
    const id = nextId();
    setTree((t) => {
      const partner = t.people[personId];
      if (!partner || partner.spouseOf) return t;      // wives do not marry again
      const gender = fields.gender || (partner.gender === 'm' ? 'f' : 'm');
      return {
        ...t,
        people: { ...t.people, [id]: makePerson({ ...fields, gender }, { id, spouseOf: personId }) },
      };
    });
    return id;
  }, []);

  const updatePerson = useCallback((id, patch) => {
    setTree((t) => ({ ...t, people: { ...t.people, [id]: { ...t.people[id], ...patch } } }));
  }, []);

  /** Remove a person, everyone under them, and the spouses of all of those. */
  const removePerson = useCallback((id) => {
    setTree((t) => {
      if (id === t.rootId) return t;
      const doomed = new Set([id]);
      let grew = true;
      while (grew) {
        grew = false;
        for (const p of Object.values(t.people)) {
          const anchor = p.parentId || p.spouseOf;
          if (anchor && doomed.has(anchor) && !doomed.has(p.id)) { doomed.add(p.id); grew = true; }
        }
      }
      return {
        ...t,
        people: Object.fromEntries(Object.entries(t.people).filter(([k]) => !doomed.has(k))),
      };
    });
  }, []);

  const reset = useCallback(() => setTree(emptyTree()), []);

  /** A backup file the family can keep, mail, or move to another phone. */
  const exportTree = useCallback(() => JSON.stringify(
    { app: 'family-tree', version: 1, savedAt: new Date().toISOString(), tree }, null, 2
  ), [tree]);

  const importTree = useCallback((text) => {
    const data = JSON.parse(text);
    const t = data.tree ?? data;
    if (!t || typeof t.people !== 'object') throw new Error('bad file');
    for (const id of Object.keys(t.people)) {
      const n = Number(String(id).replace(/^p/, ''));
      if (Number.isFinite(n) && n > seq) seq = n;
    }
    setTree({ people: t.people, rootId: t.rootId ?? null });
  }, []);

  const childrenOf = useMemo(() => {
    const map = new Map();
    for (const p of Object.values(tree.people)) {
      if (!p.parentId || p.spouseOf) continue;
      if (!map.has(p.parentId)) map.set(p.parentId, []);
      map.get(p.parentId).push(p.id);
    }
    for (const list of map.values()) {
      list.sort((a, b) => {
        const A = tree.people[a], B = tree.people[b];
        return (A.born ?? 9999) - (B.born ?? 9999) || A.id.localeCompare(B.id);
      });
    }
    return map;
  }, [tree.people]);

  /** A man may have more than one wife, so every partner list is an array. */
  const spouseOf = useMemo(() => {
    const map = new Map();
    for (const p of Object.values(tree.people)) {
      if (!p.spouseOf) continue;
      if (!map.has(p.spouseOf)) map.set(p.spouseOf, []);
      map.get(p.spouseOf).push(p);
    }
    for (const list of map.values()) {
      list.sort((a, b) => (a.born ?? 9999) - (b.born ?? 9999) || a.id.localeCompare(b.id));
    }
    return map;
  }, [tree.people]);

  return {
    tree, childrenOf, spouseOf,
    founderId: tree.rootId,
    setRoot, addChild, addAncestor, addSpouse, updatePerson, removePerson, reset,
    saved, exportTree, importTree,
  };
}
