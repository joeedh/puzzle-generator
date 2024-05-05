import {Vector2, Vector3, util, math} from '../path.ux/pathux.js';
import {vertexSmooth} from './mesh_utils.js';

export class PuzzleGenerator {
  size = new Vector2();
  props = null;
  mesh = null;
  jitter = 0.0;
  scale = 1.0;
  tabSize = 1.0;
  tabOff = 1.0;
  tabNeck = 1.0;
  tabInward = 0.5;
  inset = 0.1;
  seed = 0;

  constructor(props, mesh) {
    this.props = props;
    this.mesh = mesh;
  }

  reset(props, mesh) {
    this.props = props;
    this.mesh = mesh;

    this.size = new Vector2().loadXY(props.rows, props.columns);
    this.jitter = props.jitter;
    this.scale = props.scale;
    this.tabSize = props.tabSize;
    this.tabOff = props.tabOff;
    this.tabNeck = props.tabNeck;
    this.tabInward = props.tabInward;
    this.inset = props.inset;
    this.seed = props.seed;

    return this;
  }

  gen() {
    const {
            tabSize, mesh, props,
            size, jitter, tabOff,
            tabNeck, tabInward
          } = this;
    let scale = this.scale;

    mesh.clear();

    let [w, h] = size;
    w += 1;
    h += 1;

    let grid = new Array(w*h);

    let startx = 15, starty = 15;

    let faces = [];

    for (let i = 0; i < w; i++) {
      let x = startx + i*scale;

      for (let j = 0; j < h; j++) {
        let y = starty + j*scale;

        let v = mesh.makeVertex()
        v.loadXY(x, y);
        grid[j*w + i] = v;
      }
    }

    for (let i = 0; i < w - 1; i++) {
      for (let j = 0; j < h - 1; j++) {
        let v1 = grid[j*w + i];
        let v2 = grid[(j + 1)*w + i];
        let v3 = grid[(j + 1)*w + i + 1];
        let v4 = grid[j*w + i + 1];

        let f = mesh.makeFace([v1, v2, v3, v4]);
      }
    }

    for (let e of Array.from(mesh.edges)) {
      mesh.splitEdgeMulti(e, 3);
    }

    let offs = [
      [1, 0, 0],
      [0, -1, 0],
    ];
    let signs = [
      1, 1
    ]
    offs = offs.map(f => new Vector3(f));

    const rand = new util.MersenneRandom(this.seed);

    const doneset = new WeakSet();

    for (let f of mesh.faces) {
      let l = f.lists[0].l;

      for (let i = 0; i < offs.length; i++) {
        if (!doneset.has(l.e) && l.next.radial_next !== l.next) {
          doneset.add(l.e);
          doneset.add(l.next.e);
          doneset.add(l.next.next.e);
          doneset.add(l.next.next.next.e);

          let off = offs[i], sign = signs[i];
          let axis = off[0] !== 0.0 ? 1 : 0
          let scale2 = scale*tabSize*0.25;

          const flip = rand.random() > 0.5 ? -1 : 1;

          const tabNeck2 = tabNeck + (rand.random() - 0.5)*jitter*tabNeck;

          let c = new Vector3(l.next.v).interp(l.next.next.next.v, 0.5);
          l.next.v.sub(c).mulScalar(tabNeck2*0.5).add(c);
          l.next.next.next.v.sub(c).mulScalar(tabNeck2*0.5).add(c);

          let l1 = l.next, l3 = l.next.next.next;
          let l2 = l.next.next;

          const inward = tabInward + (rand.random() - 0.5)*jitter*tabInward;

          let sign2 = sign;
          if (axis === 0) {
            sign2 = -sign2;
          }

          l1.h1.load(l1.v);
          l1.h1[axis ^ 1] += sign2*flip*scale2*0.5;
          l1.h1[axis] += sign*scale2*inward;
          l2.h2.load(l3.v);
          l2.h2[axis ^ 1] += sign2*flip*scale2*0.5;
          l2.h2[axis] += -sign*scale2*inward;

          l2.v.addFac(off, scale2*flip);
          l2.v[0] += (rand.random() - 0.5)*jitter*scale*0.25;
          l2.v[1] += (rand.random() - 0.5)*jitter*scale*0.25;

          l2.h1.load(l2.v)
          l2.prev.h2.load(l2.v)
          l2.h1[axis] += sign*scale2*tabOff;
          l2.prev.h2[axis] -= sign*scale2*tabOff;
        }

        l = l.next.next.next.next;
      }
    }

    for (let v of mesh.verts) {
      mesh.setSelect(v, true);
    }

    if (this.inset > 0.0) {
      this.insetMesh(mesh);
    }
  }

  insetMesh(mesh) {
    let verts = new Set(mesh.verts);
    let faces = new Set(mesh.faces);

    let {inset, scale} = this;
    inset *= scale;

    let t1 = new Vector3(), t2 = new Vector3();
    let t3 = new Vector3(), t4 = new Vector3();

    for (let e of Array.from(mesh.edges)) {
      mesh.splitEdge(e, 0.5, false);
    }

    for (let f of faces) {
      let vs = Array.from(f.lists[0])
        .map(l => mesh.makeVertex(l.v))

      let f2 = mesh.makeFace(vs);
      let l1 = f.lists[0].l;
      let l2 = f2.lists[0].l;
      let _i = 0;

      do {
        if (_i++ > 10000) {
          console.error("Infinite loop error");
          break;
        }

        let n1 = l1.prev.normal(1.0);
        let n2 = l1.normal(0.0);

        let th = Math.acos(n1.dot(n2));

        let inset2 = inset/Math.cos(th/2);

        let n = n1.copy().interp(n2, 0.5).normalize()

        l2.v.addFac(n, inset2);

        l2.h1.load(l1.offsetDv(0.0, inset2)).mulScalar(1.0/3.0).add(l2.v);
        l2.prev.h2.load(l1.prev.offsetDv(1.0, inset2)).mulScalar(-1.0/3.0).add(l2.v);

        l2 = l2.next;
      } while ((l1 = l1.next) !== f.lists[0].l);
    }

    for (let v of verts) {
      mesh.killVertex(v);
    }
  }

  draw(canvas, g) {
  }
}

