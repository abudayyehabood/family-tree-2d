import { useEffect, useState } from 'react';
import { useFamilyTree } from './family/useFamilyTree';
import { TreeSvg } from './family/TreeSvg';
import { S } from './family/strings';
import './app.css';

export default function App() {
  const t = useFamilyTree();
  const [selectedId, setSelectedId] = useState(null);
  const [seed, setSeed] = useState('');

  useEffect(() => {
    if (t.founderId && !selectedId) setSelectedId(t.founderId);
  }, [t.founderId, selectedId]);

  return (
    <div className="app" dir="rtl">
      <TreeSvg
        tree={t.tree}
        childrenOf={t.childrenOf}
        spouseOf={t.spouseOf}
        spots={t.spots}
        founderId={t.founderId}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onAddChild={t.addChild}
        onAddAncestor={t.addAncestor}
        onAddSpouse={t.addSpouse}
        onEdit={t.updatePerson}
        onMove={t.movePerson}
        onClearSpots={t.clearSpots}
        onRemove={(id) => { t.removePerson(id); setSelectedId(t.founderId); }}
      />

      {!t.founderId && (
        <form className="seed" onSubmit={(e) => {
          e.preventDefault();
          if (!seed.trim()) return;
          t.setRoot({ name: seed.trim(), gender: 'm' });
          setSeed('');
        }}>
          <p>{S.startHere}</p>
          <input autoFocus value={seed} onChange={(e) => setSeed(e.target.value)} placeholder={S.oldestName} />
          <button type="submit" disabled={!seed.trim()}>{S.plant}</button>
        </form>
      )}
    </div>
  );
}
