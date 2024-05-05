import {
  simple, nstructjs, util, math, Vector2, UIBase, Icons, KeyMap, haveModal, ToolOp, ToolClasses, HotKey, createMenu,
  startMenu, Vector3, platform
} from '../path.ux/pathux.js';
import {getElemColor} from './mesh.js';
import {MeshEditor} from './mesh_editor.js';
import config from '../config/config.js';

export const SVG_URL = 'http://www.w3.org/2000/svg';

export class LoadDefaultsOp extends ToolOp {
  static tooldef() {
    return {
      uiname  : "Load Defaults",
      toolpath: "app.load_defaults",
      inputs  : {},
      outputs : {}
    }
  }

  exec(ctx) {
    ctx.state.createNewFile(true);
    window.redraw_all();
  }
}

ToolOp.register(LoadDefaultsOp);

export class Workspace extends simple.Editor {
  constructor() {
    super();

    this.canvas = document.createElement("canvas");
    this.g = this.canvas.getContext("2d");

    this.mpos = new Vector2();

    this.toolmode = new MeshEditor();
    this.shadow.appendChild(this.canvas);

    this.keymap = new KeyMap();


    this.keymap.add(new HotKey("D", [], "app.generate_puzzle"));
    this.keymap.add(new HotKey("W", [], "mesh.vertex_smooth"));
    this.keymap.add(new HotKey("Space", [], () => {
      let menu = [];

      for (let cls of ToolClasses) {
        let def = cls.tooldef();

        menu.push(def.toolpath);
      }

      menu = createMenu(this.ctx, "Find Tool", menu);

      let mpos = this.ctx.screen.mpos;
      startMenu(menu, mpos[0], mpos[1], true);

      console.log(menu);
    }));

    let eventBad = (e) => {
      if (haveModal()) {
        return true;
      }

      let elem = this.ctx.screen.pickElement(e.x, e.y);
      return elem && elem !== this && elem !== this.canvas;
    }

    this.addEventListener("pointerover", (e) => {
      let mpos = this.getLocalMouse(e.x, e.y);
      this.mpos.load(mpos);
    });

    this.addEventListener("pointerdown", (e) => {
      let mpos = this.getLocalMouse(e.x, e.y);
      this.mpos.load(mpos);

      if (eventBad(e)) {
        return;
      }

      this.toolmode.on_mousedown(mpos[0], mpos[1], e);
    });

    this.addEventListener("pointermove", (e) => {
      let mpos = this.getLocalMouse(e.x, e.y);
      this.mpos.load(mpos);

      if (eventBad(e)) {
        return;
      }

      this.toolmode.on_mousemove(mpos[0], mpos[1], e);
    });

    this.addEventListener("pointerup", (e) => {
      let mpos = this.getLocalMouse(e.x, e.y);
      this.mpos.load(mpos);

      if (eventBad(e)) {
        return;
      }

      this.toolmode.on_mouseup(mpos[0], mpos[1], e);
    });
  }

  static defineAPI(api, st) {

  }

  static define() {
    return {
      tagname : "workspace-editor-x",
      areaname: "workspace-editor-x",
      uiname  : "Workspace",
    }
  }

  getGlobalMouse(x, y) {
    let mpos = new Vector2();
    let r = this.canvas.getBoundingClientRect();

    let dpi = UIBase.getDPI();

    mpos[0] = x/dpi + r.x;
    mpos[1] = y/dpi + r.y;

    return mpos;
  }

  getLocalMouse(x, y) {
    let mpos = new Vector2();
    let r = this.canvas.getBoundingClientRect();

    let dpi = UIBase.getDPI();

    mpos[0] = (x - r.x)*dpi;
    mpos[1] = (y - r.y)*dpi;

    return mpos;
  }

  getKeyMaps() {
    return [this.keymap, this.toolmode.keymap];
  }

  init() {
    super.init();

    this.toolmode.ctx = this.ctx;

    let sidebar = this.makeSideBar();

    if (config.DRAW_TEST_IMAGES) {
      this.ctx.state.testImages.makeUI(sidebar, "testImages");
    }

    let header = this.header;
    let row;

    row = header.row();
    row.iconbutton(Icons.UNDO, "Undo", () => {
      this.ctx.toolstack.undo();
    });
    row.iconbutton(Icons.REDO, "Redo", () => {
      this.ctx.toolstack.redo();
    });

    row.button("Save Defaults", () => {
      _appstate.saveStartupFile();
    })

    row.tool("app.load_defaults()");
    row.tool("app.generate_puzzle");

    let tab;
    tab = sidebar.tab("Options");

    let props = UIBase.createElement("props-bag-editor-x");
    props.setAttribute("datapath", "properties");

    tab.add(props);

    tab.button("Export SVG", () => {
      console.log("Export!");

      let create = (type) => document.createElementNS(SVG_URL, type);

      let svg = create("svg");

      let min = new Vector3().addScalar(1e7);
      let max = new Vector3().addScalar(-1e7);

      for (let f of this.ctx.mesh.faces) {
        for (let l of f.lists[0]) {
          min.min(l.v);
          min.min(l.e.h1);
          min.min(l.e.h2);

          max.max(l.v);
          max.max(l.e.h1);
          max.max(l.e.h2);
        }
      }

      for (let v of this.ctx.mesh.verts) {
        v.sub(min);
      }
      for (let h of this.ctx.mesh.handles) {
        h.sub(min)
      }
      max.sub(min);

      for (let f of this.ctx.mesh.faces) {
        let path = create("path")

        let d = '';
        let first = true;

        for (let l of f.lists[0]) {
          if (first) {
            first = false;
            d += `M ${l.v[0]} ${l.v[1]} `;
          } else {
            let l2 = l.prev;
            d += `C ${l2.h1[0]} ${l2.h1[1]} ${l2.h2[0]} ${l2.h2[1]} ${l.v[0]} ${l.v[1]} `;
          }
        }

        d += "Z"

        svg.appendChild(path);
        path.setAttributeNS(SVG_URL, "d", d);
        path.setAttributeNS(SVG_URL, "stroke", "black");
        path.setAttributeNS(SVG_URL, "fill", "transparent");
        path.setAttribute("stroke", "black");
        path.setAttribute("fill", "transparent");
      }

      min.addScalar(-0.1);
      max.addScalar(0.1);

      let w = max[0];
      let h = max[1];

      svg.setAttribute("xmlns", SVG_URL);
      svg.setAttribute("width", w);
      svg.setAttribute("height", h);

      let data = svg.outerHTML;
      data = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n` + data;

      let blob = new Blob([data], {type: "image/svg+xml"});
      let url = URL.createObjectURL(blob);

      let a = document.createElement("a")
      a.href = url;
      a.target = "_blank"
      a.download = "puzzle.svg"
      a.click();
    });

    tab.button("Export Settings", () => {
      let data = JSON.stringify(this.ctx.state.saveSettings(), undefined, 1);
      let blob = new Blob([data], {type: "application/json"});
      let url = URL.createObjectURL(blob);

      let a = document.createElement("a")
      a.href = url;
      a.target = "_blank"
      a.download = "puzzle_settings.json"
      a.click();
    });

    tab.button("Load Settings", async () => {
      let plat = await platform.getPlatformAsync();
      const paths = await plat.showOpenDialog("Load Settings", {
        filters: [
          {
            name      : "Settings",
            mime      : "application/json",
            extensions: ["json"]
          }
        ]
      })

      const file = await paths[0].data.getFile();
      const json = await file.text();

      console.log(json);
      this.ctx.state.loadSettings(json);
    });
  }

  draw() {
    if (!this.ctx) {
      return;
    }

    let canvas = this.canvas;

    let dpi = UIBase.getDPI();
    let w = ~~(this.size[0]*dpi);
    let h = ~~(this.size[1]*dpi) - 50*dpi;

    if (w !== canvas.width || h !== canvas.height) {
      canvas.width = w;
      canvas.height = h;

      canvas.style["width"] = "" + (w/dpi) + "px";
      canvas.style["height"] = "" + (h/dpi) + "px";
    }

    console.log("draw!");
    this.g.clearRect(0, 0, canvas.width, canvas.height);

    if (config.DRAW_TEST_IMAGES) {
      this.ctx.state.testImages.draw(canvas, this.g);
    }

    if (this.ctx.properties.autoGenerate) {
      this.ctx.puzzlegen.reset(this.ctx.properties, this.ctx.mesh);
      this.ctx.puzzlegen.gen()
    }

    this.ctx.puzzlegen.draw(this.canvas, this.g);
    this.toolmode.draw(this.ctx, this.canvas, this.g);
  }

  setCSS() {
    this.canvas.style["position"] = "absolute";
  }
}

Workspace.STRUCT = nstructjs.inherit(Workspace, simple.Editor, "Workspace") + `
}`;
simple.Editor.register(Workspace);

