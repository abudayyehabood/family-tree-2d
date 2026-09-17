import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { NODE_R, layoutTree } from './layout2d';
import { TREE_CSS } from './treeStyle';
import { usePanZoom } from './usePanZoom';
import { Limb } from './Limb';
import { Foliage } from './Foliage';
import { TrunkWood } from './Trunk';
import { MarriageBar, PersonShape } from './PersonShapes';
import { PersonPopover } from './PersonPopover';
import { S } from './strings';
import { saveFile, useCanSave } from './saveFile';

export function TreeSvg({
  tree, childrenOf, spouseOf, selectedId,
  onSelect, onAddChild, onAddAncestor, onAddSpouse, onEdit, onRemove,
}) {
  const svgRef = useRef(null);
  const gRef = useRef(null);
  const [popOpen, setPopOpen] = useState(false);
  const [pos, setPos] = useState(null);

  const { nodes, edges, marriages, bounds, trunk } = useMemo(
    () => layoutTree(tree, childrenOf, spouseOf),
    [tree, childrenOf, spouseOf]
  );
  const { transform, handlers, reset, zoomIn, zoomOut, focusOn } =
    usePanZoom(svgRef, gRef, bounds, () => setPopOpen(false));

  /** Double-click a name, or use the button, to blow up that corner of the tree. */
  const focusPerson = useCallback((id) => {
    const n = nodes.get(id);
    if (n) focusOn({ x: n.x, y: n.y }, 3.2);
  }, [nodes, focusOn]);

  const node = popOpen ? nodes.get(selectedId) : null;

  // follow the person around while you pan, zoom, or grow the tree
  useLayoutEffect(() => {
    if (!node || !svgRef.current || !gRef.current) { setPos(null); return; }
    const svg = svgRef.current;
    const p = svg.createSVGPoint();
    p.x = node.x;
    p.y = node.y - (node.r || NODE_R) - 10;
    const s = p.matrixTransform(gRef.current.getScreenCTM());
    const r = svg.getBoundingClientRect();
    // the card is centred on this point, so keep half of it inside the screen.
    // The widths mirror .pop in app.css, phone breakpoint included.
    const cardW = Math.min(r.width <= 760 ? 280 : 232, r.width - 28);
    const half = cardW / 2 + 6;
    const x = Math.min(Math.max(s.x - r.left, half), r.width - half);
    const y = Math.max(s.y - r.top, 250);
    setPos({ x, y });
  }, [node, node?.x, node?.y, transform, bounds]);

  const pick = useCallback((id) => { onSelect(id); setPopOpen(true); }, [onSelect]);

  /**
   * The crown is thousands of paths. Panning only changes the transform on the
   * group, so the drawing itself is built once per tree and reused; without
   * this React walks every leaf again on each frame.
   */
  const scene = useMemo(() => (
    <>
      <TrunkWood trunk={trunk} />
      {edges.map(({ from, to }) => (
        <Limb key={`${from}-${to}`} from={nodes.get(from)} to={nodes.get(to)} />
      ))}
      <Foliage nodes={nodes} edges={edges} />
      {marriages.map(({ a, b }) => (
        <MarriageBar key={`${a}-${b}`} a={nodes.get(a)} b={nodes.get(b)} />
      ))}
      {[...nodes.values()]
        .filter((n) => n.person)
        .sort((a, b) => Number(Boolean(a.isFounder)) - Number(Boolean(b.isFounder)))
        .map((n) => (
          <PersonShape key={n.id} node={n} selected={n.id === selectedId}
                       onSelect={pick} onFocus={focusPerson} />
        ))}
    </>
  ), [nodes, edges, marriages, trunk, selectedId, pick, focusPerson]);

  // a click anywhere that is not the card itself puts the card away
  useEffect(() => {
    if (!popOpen) return;
    const away = (e) => { if (!e.target.closest?.('.pop')) setPopOpen(false); };
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
  }, [popOpen]);

  const canSave = useCanSave();

  const savePoster = (kind) => {
    const svg = svgRef.current;
    const clone = svg.cloneNode(true);
    clone.setAttribute('class', (clone.getAttribute('class') || '').replace('is-moving', ''));  // a poster always gets the full detail
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.setAttribute('width', Math.round(bounds.w));
    clone.setAttribute('height', Math.round(bounds.h));
    clone.querySelector('g[transform]')?.setAttribute('transform', 'translate(0 0) scale(1)');
    const markup = new XMLSerializer().serializeToString(clone);

    if (kind === 'svg') {
      saveFile('family-tree.svg', new Blob([markup], { type: 'image/svg+xml' }));
      return;
    }

    const url = URL.createObjectURL(new Blob([markup], { type: 'image/svg+xml' }));
    const img = new Image();
    img.onload = () => {
      const scale = 2400 / bounds.w;               // poster resolution
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(bounds.w * scale);
      canvas.height = Math.round(bounds.h * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      canvas.toBlob((blob) => blob && saveFile('family-tree.png', blob), 'image/png');
    };
    img.src = url;
  };

  return (
    <>
      <svg
        ref={svgRef}
        className="tree-svg"
        viewBox={`${bounds.x} ${bounds.y} ${bounds.w} ${bounds.h}`}
        preserveAspectRatio="xMidYMid meet"
        {...handlers}
        onPointerDown={(e) => { setPopOpen(false); handlers.onPointerDown?.(e); }}
      >
        <style>{TREE_CSS}</style>
        <rect x={bounds.x} y={bounds.y} width={bounds.w} height={bounds.h} className="paper" />

        <g ref={gRef} transform={transform}>{scene}</g>
      </svg>

      {node && pos && (
        <PersonPopover
          person={node.person}
          isLeaf={node.isLeaf}
          isSpouse={Boolean(node.isSpouse)}
          spouses={spouseOf.get(node.id) ?? []}
          mother={node.person.motherId ? tree.people[node.person.motherId] : null}
          childCount={node.isSpouse
            ? Object.values(tree.people).filter((p) => p.motherId === node.id).length
            : childrenOf.get(node.id)?.length ?? 0}
          generation={node.depth + 1}
          pos={pos}
          canRemove={node.id !== tree.rootId}
          isRoot={node.id === tree.rootId}
          onAddChild={onAddChild}
          onAddAncestor={onAddAncestor}
          onAddSpouse={onAddSpouse}
          onEdit={onEdit}
          onRemove={(id) => { setPopOpen(false); onRemove(id); }}
          onClose={() => setPopOpen(false)}
        />
      )}

      <div className="toolbar">
        <button onClick={zoomIn} aria-label={S.zoomIn}>+</button>
        <button onClick={zoomOut} aria-label={S.zoomOut}>−</button>
        <button onClick={() => selectedId && focusPerson(selectedId)} disabled={!selectedId}>{S.focus}</button>
        <button onClick={reset}>{S.resetView}</button>
        <button onClick={() => window.print()}>{S.print}</button>
        {canSave && <button onClick={() => savePoster('png')}>{S.savePng}</button>}
        {canSave && <button onClick={() => savePoster('svg')}>{S.saveSvg}</button>}
      </div>
    </>
  );
}
