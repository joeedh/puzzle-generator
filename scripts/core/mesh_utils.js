import {Vertex} from './mesh.js';

export function vertexSmooth(mesh, verts = mesh.verts, fac = 0.5, doHandles = true) {
  let co = new Vertex();

  let edges;
  edges = new Set();

  if (mesh.haveHandles && doHandles) {
    for (let v of verts) {
      for (let e of v.edges) {
        edges.add(e);
      }
    }

    for (let e of edges) {
      e.h1.sub(e.v1);
      e.h2.sub(e.v2);
    }
  }

  for (let v of verts) {
    co.zero();
    let tot = 0.0;

    for (let e of v.edges) {
      let v2 = e.otherVertex(v);

      co.add(v2);
      tot += 1.0;
    }

    if (tot !== 0.0) {
      co.mulScalar(1.0/tot);
      v.interp(co, 0.5);
    }
  }

  if (mesh.haveHandles && doHandles) {
    for (let e of edges) {
      e.h1.add(e.v1);
      e.h2.add(e.v2);
    }
  }
}
