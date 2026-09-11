import { useEffect, useRef, useState } from 'react';
import { S } from './strings';
import { saveFile, useCanSave } from './saveFile';

export function Panel({
  tree, childrenOf, spouseOf, founderId,
  selectedId, onSelect, onSetRoot, onAddChild, onRemove, onReset,
  saved, onExport, onImport,
}) {
  const fileRef = useRef(null);
  const canSave = useCanSave();
  const [fileError, setFileError] = useState('');
  const [backupOpen, setBackupOpen] = useState(false);
  const [text, setText] = useState('');
  const [copied, setCopied] = useState(false);
  const [name, setName] = useState('');
  const [born, setBorn] = useState('');
  const [gender, setGender] = useState('m');

  const root = tree.people[founderId];
  const selected = tree.people[selectedId];
  const count = Object.keys(tree.people).length;

  useEffect(() => { setName(''); setBorn(''); }, [founderId, selectedId]);

  const submit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    const fields = { name, gender, born: born ? Number(born) : null };
    if (!root) onSetRoot(fields);
    else if (selectedId) onAddChild(selectedId, fields);
    setName(''); setBorn('');
  };

  const isLeaf = selected && (childrenOf.get(selectedId)?.length ?? 0) === 0;

  const saveBackup = () => saveFile(
    `family-tree-${new Date().toISOString().slice(0, 10)}.json`, onExport()
  );

  const openBackup = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try { const t = await file.text(); onImport(t); setText(t); setFileError(''); }
    catch { setFileError(S.backupBad); }
  };

  const savedLabel = saved?.failed
    ? S.autoSaveOff
    : saved?.at
      ? S.autoSaved(new Date(saved.at).toLocaleTimeString('ar', { hour: '2-digit', minute: '2-digit' }))
      : '';

  return (
    <aside className="panel">
      <h1>{S.title}</h1>
      <p className="step">{root ? S.people(count) : S.startHere}</p>

      <form onSubmit={submit}>
        <label>
          {!root ? S.oldestName : selected ? S.addChildTo(selected.name) : S.pickSomeone}
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder={S.name} />
        </label>
        <label>
          {S.born}
          <input value={born} onChange={(e) => setBorn(e.target.value)} placeholder="1948" inputMode="numeric" />
        </label>
        <div className="row">
          <label className="inline"><input type="radio" checked={gender === 'm'} onChange={() => setGender('m')} /> {S.male}</label>
          <label className="inline"><input type="radio" checked={gender === 'f'} onChange={() => setGender('f')} /> {S.female}</label>
        </div>
        <button type="submit" disabled={Boolean(root) && !selectedId}>
          {root ? S.addSon : S.plant}
        </button>
      </form>

      <p className="hint">
        {selected
          ? <>{S.selected} <strong>{selected.name}</strong>
              {spouseOf.get(selectedId) ? ` · ${S.marriedTo(spouseOf.get(selectedId).name)}` : ''}
              {isLeaf ? ` — ${S.leafHint}` : ''}</>
          : S.hintIdle}
      </p>

      {root && (
        <label className="jump">
          {S.jumpTo}
          <select value={selectedId ?? ''} onChange={(e) => onSelect(e.target.value)}>
            <option value="">—</option>
            {Object.values(tree.people).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
      )}

      <button className="danger" disabled={!selectedId || selectedId === founderId}
              onClick={() => { onRemove(selectedId); onSelect(founderId); }}>
        {S.removeBranch}
      </button>
      <p className={`saved ${saved?.failed ? 'is-bad' : ''}`}>{savedLabel}</p>

      <button className="ghost" onClick={() => {
        setBackupOpen((v) => !v); setText(onExport()); setCopied(false); setFileError('');
      }}>{S.backup}</button>

      {backupOpen && (
        <div className="backup">
          <p className="hint">{S.backupHint}</p>
          <textarea value={text} onChange={(e) => setText(e.target.value)} spellCheck="false" />
          <div className="row">
            <button className="ghost" onClick={async () => {
              try { await navigator.clipboard.writeText(text); setCopied(true); } catch { setCopied(false); }
            }}>{copied ? S.backupCopied : S.backupCopy}</button>
            <button className="ghost" onClick={() => {
              try { onImport(text); setFileError(''); } catch { setFileError(S.backupBad); }
            }}>{S.backupRestore}</button>
          </div>
          <div className="row">
            {canSave && <button className="ghost" onClick={saveBackup} disabled={!count}>{S.backupSave}</button>}
            <button className="ghost" onClick={() => fileRef.current?.click()}>{S.backupOpen}</button>
          </div>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={openBackup} />
          {fileError && <p className="saved is-bad">{fileError}</p>}
        </div>
      )}

      <button className="ghost" onClick={() => { if (confirm(S.confirmReset)) onReset(); }}>{S.startOver}</button>
    </aside>
  );
}
