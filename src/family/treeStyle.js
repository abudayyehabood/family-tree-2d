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
.clump-mass { fill: #2c6323; opacity: 0.42; }
.foliage-back .clump-mass { filter: url(#haze); opacity: 0.5; }
.foliage-back .leaf { opacity: 0.85; }
.foliage-back .leaf-a { fill: #27591f; }
.foliage-back .leaf-b { fill: #2d6a28; }
.foliage-back .leaf-c { fill: #1d451a; }
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

.marriage-line { stroke: #a5811f; stroke-width: 2.4; stroke-dasharray: 5 4; }
`;
