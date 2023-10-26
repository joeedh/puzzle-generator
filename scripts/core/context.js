import config from '../config/config.js';

/* Set default undo handlers; they just saves and reload the file
*  minus the screen layout.*/

import {simple, ToolOp} from '../path.ux/scripts/pathux.js';
import {Workspace} from './editor.js';
import {MeshTypes} from './mesh.js';
import {ImageWrangler} from './image_wrangler.js';

ToolOp.prototype.undoPre = function (ctx) {
  this._undo = ctx.state.saveFileSync({
    doScreen: false
  });
}

ToolOp.prototype.undo = function (ctx) {
  ctx.state.loadFileSync(this._undo, {
    resetToolStack: false,
    resetContext  : false,
    doScreen      : false,
    resetOnLoad   : false
  });
}

export class Context {
  constructor(state) {
    this.state = state;
  }

  get workspace() {
    return simple.Editor.findEditor(Workspace);
  }

  get selMask() {
    return config.SELECTMASK;
  }

  get mesh() {
    return this.state.mesh;
  }

  get properties() {
    return this.state.properties;
  }

  get testImages() {
    return this.state.testImages;
  }

  static defineAPI(api, st) {
    st.struct("testImages", "testImages", "Test Images", api.mapStruct(ImageWrangler));
    st.dynamicStruct("properties", "properties", "Properties");
  }
}
