import {util, math, Vector2, Vector3} from '../path.ux/scripts/pathux.js';

/*

on factor;
off period;

procedure bez(a1, b1);
a1 + (b1 - a1)*s;

lin   := bez(k1, k2);
quad  := bez(lin, sub(k2=k3, k1=k2, lin));
cubic := bez(quad, sub(k3=k4,k2=k3,k1=k2, quad));

on fort;
cubic;
dcubic := df(cubic, s);
dcubic2 := df(cubic, s, 2);
off fort;

%direct offset curve solve
x1 := 0;
y1 := 0;

px := sub(k1=x1, k2=x2, k3=x3, k4=x4, cubic);
py := sub(k1=y1, k2=y2, k3=y3, k4=y4, cubic);

nx := df(py, s) / (df(px, s)**2 + df(py, s)**2);
ny := -df(px, s) / (df(px, s)**2 + df(py, s)**2);

offx := px + nx*radius;
offy := py + ny*radius;
df(offx, s);
df(offy, s);

%symbolic offset method
on factor;
off period;
operator offx, offy, dx, dy, dx2, dy2;

let df(offx(s), s) = dx;
let df(dx, s) = dx2;
let df(offy(s), s) = dy;
let df(dy, s) = dy2;

nx := df(offy(s), s) / sqrt(df(offx(s), s)**2 + df(offy(s), s)**2);
ny := -df(offx(s), s) / sqrt(df(offx(s), s)**2 + df(offy(s), s)**2);

px := offx(s) + nx*radius;
py := offy(s) + ny*radius;

on fort;
df(px, s);
df(py, s);
off fort;

*/

export function cubic(k1, k2, k3, k4, s) {
  return -(k1*s**3 - 3*k1*s**2 + 3*k1*s - k1 - 3*k2*s**3 + 6*k2*s**2 - 3*k2*s + 3*
    k3*s**3 - 3*k3*s**2 - k4*s**3);
}

export function dcubic(k1, k2, k3, k4, s) {
  return -3*((s - 1)**2*k1 - k4*s**2 + (3*s - 2)*k3*s - (3*s - 1)*(s - 1)*k2);
}

export function d2cubic(k1, k2, k3, k4, s) {
  return -6*(k1*s - k1 - 3*k2*s + 2*k2 + 3*k3*s - k3 - k4*s);
}


let offsetdvs = util.cachering.fromConstructor(Vector3, 64);

export function cubicOffsetDv(a, b, c, d, s, radius) {
  let dv = offsetdvs.next();
  let dv2 = offsetdvs.next();

  for (let i = 0; i < 2; i++) {
    dv[i] = dcubic(a[i], b[i], c[i], d[i], s);
    dv2[i] = d2cubic(a[i], b[i], c[i], d[i], s);
  }

  let [dx, dy] = dv;
  let [dx2, dy2] = dv2;
  let sqrt = Math.sqrt;

  let ret = offsetdvs.next();

  if (dx === 0.0 && dy === 0.0) {
    return ret.load(d).sub(a);
  }

  const div = sqrt(dx**2 + dy**2)*(dx**2 + dy**2);

  //console.log("dv", dx, dy, dx2, dy2, radius, s);

  ret[0] = ((sqrt(dx**2 + dy**2)*dx**2 + sqrt(dx**2 + dy**2)*dy**2 + dx*dy2*
    radius - dx2*dy*radius)*dx)/div;
  ret[1] = ((sqrt(dx**2 + dy**2)*dx**2 + sqrt(dx**2 + dy**2)*dy**2 + dx*dy2*
    radius - dx2*dy*radius)*dy)/div;

  return ret;
}