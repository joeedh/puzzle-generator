import {
  simple, util, Vector2, Vector3, Matrix4, math, ToolOp, PropTypes,
  NumberConstraints, TextBoxBase, nstructjs
} from '../path.ux/pathux.js';

import './editor.js';
import {Mesh, MeshTypes} from './mesh.js';
import {Workspace} from './editor.js';
import {FileArgs} from '../path.ux/scripts/simple/file.js';
import {PropertiesBag} from './property_templ.js';
import {Context} from './context.js';
import config from '../config/config.js';
import {ImageWrangler} from './image_wrangler.js';

nstructjs.setWarningMode(0);

export const STARTUP_FILE_KEY = "_startup_file_1";

export const Properties = {
  steps  : {type: "int", value: 1, min: 0, max: 10, slideSpeed: 5},
  boolVal: {type: "bool", value: true},
  panel  : {
    type  : "panel",
    float : {type: "float", value: 0, min: 0, max: 10, step: 0.05, decimalPlaces: 3},
    slider: {type: "float", slider: true, value: 0, min: 0, max: 10, step: 0.05, decimalPlaces: 3},
  }
};

/* See config.DRAW_TEST_IMAGES */
export const TestImages = {
  imageColumns : 2,
  singletonMode: false,
  test1        : {
    size: [128, 256],
  },
  test2        : {
    dimen: 256
  },
  test3        : {
    dimen: 128
  },
};

window.addEventListener("contextmenu", (e) => {
  console.log(e);

  if (window._appstate && _appstate.screen) {
    let elem = _appstate.screen.pickElement(e.x, e.y);

    if (elem instanceof TextBoxBase || elem.tagName === "INPUT") {
      return;
    }
  }
  e.preventDefault();
});


export class App extends simple.AppState {
  constructor() {
    super(Context);

    this.mesh = undefined;
    this.properties = undefined;

    this.createNewFile(true);

    this.saveFilesInJSON = true;
    let dimen = 128;

    this.testImages = new ImageWrangler(TestImages);
  }

  createNewFile(noReset = false) {
    if (!noReset) {
      this.reset();
      this.makeScreen();
    }

    this.properties = new PropertiesBag(Properties);

    this.mesh = new Mesh();
    let s = 50;
    let d = 200;
    let v1 = this.mesh.makeVertex([s, s, 0]);
    let v2 = this.mesh.makeVertex([s, s + d, 0]);
    let v3 = this.mesh.makeVertex([s + d, s + d, 0]);
    let v4 = this.mesh.makeVertex([s + d, s, 0]);

    this.mesh.makeFace([v1, v2, v3, v4]);
  }

  saveStartupFile() {
    this.saveFile().then((json) => {
      json = JSON.stringify(json);

      localStorage[STARTUP_FILE_KEY] = json;
      console.log("Saved startup file", (json.length/1024.0).toFixed(2) + "kb");
    });
  }

  loadStartupFile() {
    if (!(STARTUP_FILE_KEY in localStorage)) {
      return;
    }

    try {
      let json = JSON.parse(localStorage[STARTUP_FILE_KEY]);
      this.loadFile(json);
    } catch (error) {
      util.print_stack(error);
      console.warn("Failed to load startup file");
      this.createNewFile();
    }
  }

  getFileObjects() {
    return [this.mesh, this.properties, this.testImages];
  }

  saveFileSync(objects, args = {}) {
    if (args.useJSON === undefined) {
      args.useJSON = true;
    }

    return super.saveFileSync(this.getFileObjects(), args);
  }

  saveFile(args = {}) {
    return new Promise((accept, reject) => {
      accept(this.saveFileSync(this.getFileObjects(), args));
    });
  }

  loadFileSync(data, args = {}) {
    if (args.useJSON === undefined) {
      args.useJSON = true;
    }

    let file = super.loadFileSync(data, args);
    console.log(file.objects);

    this.mesh = file.objects[0];
    this.properties = file.objects[1] ?? this.properties;

    this.properties.patchTemplate(Properties);

    for (let obj of file.objects) {
      if (obj instanceof ImageWrangler) {
        this.testImages = obj;
        this.testImages.loadFromTemplate(TestImages);
      }
    }

    window.redraw_all();

    return file;
  }

  loadFile(data, args = {}) {
    return new Promise((accept, reject) => {
      accept(this.loadFileSync(data, args));
    });
  }

  draw() {
    for (let sarea of this.screen.sareas) {
      if (sarea.area && sarea.area.draw) {
        sarea.area.draw();
      }
    }
  }

  start() {
    super.start({
      DEBUG: {
        modalEvents: true
      }
    });

    this.loadStartupFile();
  }
}

export function start() {
  console.log("start!");

  let animreq = undefined;

  function f() {
    animreq = undefined;

    _appstate.draw();
  }

  let ignore_lvl = 0;
  window.draw_ignore_push = function () {
    ignore_lvl++;
  }
  window.draw_ignore_pop = function () {
    ignore_lvl = Math.max(ignore_lvl - 1, 0);
  }

  window.redraw_all = function () {
    if (animreq || ignore_lvl) {
      return;
    }

    console.warn("redraw_all");
    animreq = requestAnimationFrame(f);
  }

  window._appstate = new App();
  _appstate.start();

  if (config.AUTOSAVE) {
    window.setInterval(() => {
      _appstate.saveStartupFile();
    }, config.AUTOSAVE_INTERVAL_MS);
  }

  window.redraw_all();
}