/**
 * Everything the drawing itself needs. It is injected inside the <svg>, so a
 * saved or printed poster carries its own look with it.
 */
export const TREE_CSS = `
.paper { fill: #f4f1e8; }

.limb-wood, .trunk-wood { fill: #4a2b1c; }
.wood-light { fill: #6b4227; opacity: 0.6; }
.fissure { fill: none; stroke: #2b1608; stroke-width: 2.6; stroke-linecap: round; opacity: 0.6; }
.ground-shadow { fill: #6b6350; opacity: 0.1; }
.grain { fill: none; stroke: #7b5030; stroke-width: 1.3; stroke-linecap: round; opacity: 0.8; }
.knot { fill: #35200f; opacity: 0.75; }
.knot-core { fill: #6d472c; opacity: 0.7; }
.speck { fill: #7a5636; opacity: 0.55; }

.leaf { stroke: #1e4a1b; stroke-width: 0.6; }
.leaf-a { fill: #2f6b2e; }
.leaf-b { fill: #3d8236; }
.leaf-c { fill: #24541f; }
.leaf-rib { stroke: #e9f2d8; stroke-width: 1.1; opacity: 0.45; fill: none; }
.leaf-vein { stroke: #e9f2d8; stroke-width: 0.7; opacity: 0.32; fill: none; }

.person { cursor: pointer; }
.halo { fill: #e0a92c; opacity: 0.28; }
.disc { fill: #fdfbf3; stroke: #5a3a24; stroke-width: 1.8; }
.circle-person.is-male .disc { fill: #cfe3f7; stroke: #2f6ea8; }
.circle-person.is-female .disc { fill: #fbd9e6; stroke: #b4557f; }
.circle-person.is-gold .disc { stroke-width: 3.6; }
.circle-person.is-gold.is-male .disc { fill: #b9d7f4; }
.circle-person.is-gold.is-female .disc { fill: #f9c9de; }
.circle-person.is-spouse .disc { stroke-dasharray: 4 3; }
.circle-person:hover .disc { filter: brightness(1.06); }
.circle-person.is-selected .disc { stroke: #c8901c; stroke-width: 3.4; }
.disc-name { fill: #21303c; font-weight: 600;
  font-family: 'Noto Naskh Arabic', 'Amiri', 'Iowan Old Style', Georgia, serif; }
.circle-person.is-female .disc-name { fill: #4a1c31; }
.disc-year { font-size: 9px; fill: #6f6152; font-family: system-ui, sans-serif; }

.canopy { fill: none; stroke-linecap: round; stroke-linejoin: round; }
.canopy-edge { stroke: #4a453c; opacity: 0.6; }
.canopy-sweep { stroke: #4a453c; opacity: 0.32; }
.canopy-hatch { stroke: #4a453c; opacity: 0.38; }

.wed-wood { fill: #9a6630; }
.wed-light { fill: #c79154; opacity: 0.65; }
.wed-grain { fill: none; stroke: #7a4a22; stroke-width: 1.1; stroke-linecap: round; opacity: 0.6; }

/* While a finger is dragging or pinching, the drawing is re-rasterised every
   frame, and none of this fine detail is readable mid-gesture anyway, so it is
   dropped until the fingers lift. */
.is-moving .leaf-vein, .is-moving .leaf-rib, .is-moving .grain,
.is-moving .fissure, .is-moving .wed-grain, .is-moving .canopy-hatch,
.is-moving .canopy-sweep, .is-moving .knot-core, .is-moving .speck { display: none; }
.is-moving .leaf { stroke: none; }
`;
