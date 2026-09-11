import { useEffect, useRef, useState } from 'react';
import { S } from './strings';

/**
 * Floating card anchored to whoever you clicked. Add sons, daughters, or the
 * person they married, edit them, or delete them, without leaving the tree.
 * Drag it by its head when it covers something you want to see.
 */
export function PersonPopover({
  person, isLeaf, spouses = [], mother = null, childCount, generation, pos,
  onAddChild, onAddSpouse, onEdit, onRemove, onClose, canRemove,
}) {
  const [tab, setTab] = useState('child');
  const [name, setName] = useState('');
  const [born, setBorn] = useState('');
  const [gender, setGender] = useState('m');
  const [editing, setEditing] = useState(false);
  const [drag, setDrag] = useState({ dx: 0, dy: 0 });
  const inputRef = useRef(null);
  const from = useRef(null);

  const isWife = person.gender === 'm';
  const partnerWord = isWife ? S.wife : S.husband;
  // Someone who is themselves a wife does not get married again from here.
  const canMarry = !person.spouseOf && (isWife || spouses.length === 0);

  useEffect(() => {
    setName(''); setBorn(''); setGender('m'); setTab('child');
    setEditing(false); setDrag({ dx: 0, dy: 0 });
    inputRef.current?.focus();
  }, [person.id]);

  // editing starts from what the person already has
  useEffect(() => {
    if (!editing) return;
    setName(person.name);
    setBorn(person.born ? String(person.born) : '');
    setGender(person.gender);
    inputRef.current?.focus();
  }, [editing]);

  const startDrag = (e) => {
    if (e.target.closest('button, input, form')) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    from.current = { x: e.clientX, y: e.clientY, dx: drag.dx, dy: drag.dy };
  };
  const moveDrag = (e) => {
    if (!from.current) return;
    setDrag({
      dx: from.current.dx + (e.clientX - from.current.x),
      dy: from.current.dy + (e.clientY - from.current.y),
    });
  };
  const endDrag = () => { from.current = null; };

  const submit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    const fields = { name: name.trim(), born: born ? Number(born) : null };
    if (editing) { onEdit(person.id, { ...fields, gender }); setEditing(false); setName(''); setBorn(''); return; }
    if (tab === 'child') onAddChild(person.id, { ...fields, gender });
    else onAddSpouse(person.id, { ...fields, gender: person.gender === 'm' ? 'f' : 'm' });
    setName(''); setBorn('');
    inputRef.current?.focus();
  };

  const status = `${S.generation(generation)} · ${isLeaf ? S.noChildren : S.children(childCount)}`;

  return (
    <div
      className={`pop ${drag.dx || drag.dy ? 'is-moved' : ''}`}
      style={{ left: pos.x + drag.dx, top: pos.y + drag.dy }}
      onPointerDown={(e) => { e.stopPropagation(); startDrag(e); }}
      onPointerMove={moveDrag}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      <button className="pop-x" onClick={onClose} title={S.close}>×</button>
      <p className="pop-who">
        <strong>{person.name}</strong>
        <span>
          {status}
          {spouses.length ? ` · ${S.marriedToAll(spouses.map((p) => p.name))}` : ''}
          {mother ? ` · ${S.motherIs(mother.name)}` : ''}
        </span>
      </p>

      {!editing && canMarry && (
        <div className="pop-tabs">
          <button type="button" className={tab === 'child' ? 'on' : ''} onClick={() => setTab('child')}>{S.child}</button>
          <button type="button" className={tab === 'spouse' ? 'on' : ''} onClick={() => setTab('spouse')}>{partnerWord}</button>
        </div>
      )}

      <form onSubmit={submit}>
        <input ref={inputRef} value={name} onChange={(e) => setName(e.target.value)}
               placeholder={editing ? S.name : tab === 'child' ? S.childName : S.spouseName} />
        <div className="pop-row">
          <input className="yr" value={born} onChange={(e) => setBorn(e.target.value)} placeholder={S.born} inputMode="numeric" />
          {(editing || tab === 'child') && (
            <div className="pop-seg">
              <button type="button" className={gender === 'm' ? 'on' : ''} onClick={() => setGender('m')}>{editing ? S.male : S.son}</button>
              <button type="button" className={gender === 'f' ? 'on' : ''} onClick={() => setGender('f')}>{editing ? S.female : S.daughter}</button>
            </div>
          )}
        </div>
        <button type="submit" className="pop-add" disabled={!name.trim()}>
          {editing
            ? S.saveEdit
            : tab === 'child'
              ? (gender === 'm' ? S.addSon : S.addDaughter)
              : (isWife ? (spouses.length ? S.addAnotherWife : S.addWife) : S.addHusband)}
        </button>
      </form>

      <div className="pop-acts">
        <button className="pop-edit" onClick={() => setEditing((v) => !v)}>
          {editing ? S.cancelEdit : S.edit}
        </button>
        {canRemove && (
          <button className="pop-del" onClick={() => onRemove(person.id)}>{S.deleteShort}</button>
        )}
      </div>
    </div>
  );
}
