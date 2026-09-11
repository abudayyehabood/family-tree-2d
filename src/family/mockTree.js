// Flat and normalized. `photo` is any image URL or data: URL, or null for a
// generated portrait.
export const MOCK_TREE = {
  rootId: 'p1',
  people: {
    p1: { id: 'p1', name: 'Ibrahim', gender: 'm', born: 1921, died: 1998, parentId: null, photo: null },
    p2: { id: 'p2', name: 'Hana',    gender: 'f', born: 1949, parentId: 'p1', photo: null },
    p3: { id: 'p3', name: 'Yusuf',   gender: 'm', born: 1952, parentId: 'p1', photo: null },
    p4: { id: 'p4', name: 'Layla',   gender: 'f', born: 1955, parentId: 'p1', photo: null },
    p5: { id: 'p5', name: 'Omar',    gender: 'm', born: 1974, parentId: 'p2', photo: null },
    p6: { id: 'p6', name: 'Rania',   gender: 'f', born: 1977, parentId: 'p2', photo: null },
    p7: { id: 'p7', name: 'Karim',   gender: 'm', born: 1980, parentId: 'p3', photo: null },
    p8: { id: 'p8', name: 'Salma',   gender: 'f', born: 2001, parentId: 'p5', photo: null },
    p9: { id: 'p9', name: 'Tariq',   gender: 'm', born: 2004, parentId: 'p5', photo: null },
  },
};
