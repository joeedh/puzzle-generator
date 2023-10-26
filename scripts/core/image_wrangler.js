/** Library to deal with debug visualization images.
 *
 * Images are drawn either in tiles or exclusively
 * one at a time.
 */

import {Vector2, nstructjs, util, math, simple, ToolProperty} from '../path.ux/pathux.js';
import {DataModel} from '../path.ux/scripts/simple/app.js';

export class ImageItemIF {
  name = "name";
  size = [512, 512];
  description = "";
  uiName = undefined;
}

export class ImageTile {
  image = null;
  size = new Vector2([512, 512]);
  name = "name";
  pos = new Vector2();
  id = 0;
  enumkey = "";
  description = "";
  enabled = true;

  constructor(size, name, description = "", uiName = undefined) {
    this.size.load(size);
    this.name = name;
    this.description = description;
    this.uiName = uiName;
  }

  static fromImageItem(item) {
    return new ImageTile(item.size, item.name, item.description, item.uiName);
  }
}

export class ImageWrangler extends simple.DataModel {
  _tiles = [];
  images = {};
  columns = 2;
  singletonMode = false; /* Show only one image at a time. */
  apiStructNeedsDefine = true;
  visible = true;
  _enabled_images = undefined;

  static apiStruct = undefined;

  static STRUCT = `
ImageWrangler {
  visible         : bool;
  _enabled_images : int | this.enabled_images;
}
  `;

  constructor(template = undefined, singletonMode = false) {
    super();

    this.singletonMode = singletonMode;
    if (template !== undefined) {
      this.loadFromTemplate(template);
    }
  }

  loadSTRUCT(reader) {
    reader(this);
  }

  static defineAPI(api, st) {
    this.apiStruct = st;

    st.bool("visible", "visible", "Visible")
      .description("Show or hide all images.")
      .on("change", () => window.redraw_all());
  }

  checkApiStruct() {
    if (!this.constructor.apiStruct || !this.apiStructNeedsDefine) {
      return;
    }

    this.apiStructNeedsDefine = false;

    let st = this.constructor.apiStruct;
    let enumdef = {};
    let flagdef = {};
    let uinames = {};
    let descr = {};

    for (let tile of this._tiles) {
      enumdef[tile.enumkey] = tile.id;
      flagdef[tile.enumkey] = 1<<tile.id;
      uinames[tile.enumkey] = tile.uiName ? tile.uiName : ToolProperty.makeUIName(tile.name);
      descr[tile.enumkey] = tile.description;
    }

    console.error("UINAMES", uinames)

    st.flags("enabled_images", "enabled_images", flagdef, "Enabled Images")
      .uiNames(uinames)
      .descriptions(descr);

    st.enum("active_image", "active_image", enumdef, "Active Image")
      .uiNames(uinames)
      .descriptions(descr)
      .checkStrip();
  }

  get active_image() {
    for (let tile of this._tiles) {
      if (tile.enabled) {
        return tile.id;
      }
    }

    return -1;
  }

  set active_image(v) {
    for (let tile of this._tiles) {
      tile.enabled = v === tile.id;
    }

    window.redraw_all();
  }

  get enabled_images() {
    let mask = 0;
    for (let tile of this._tiles) {
      if (tile.enabled) {
        mask |= 1<<tile.id;
      }
    }

    return mask;
  }

  set enabled_images(v) {
    for (let tile of this._tiles) {
      tile.enabled = v & (1<<tile.id);
    }

    window.redraw_all();
  }

  makeUI(container, datapath) {
    console.log(container)

    container.label("Test Images");
    container.prop(`${datapath}.visible`);
    if (this.singletonMode) {
      container.prop(`${datapath}.active_image`);
    } else {
      container.prop(`${datapath}.enabled_images`);
    }
  }

  loadFromTemplate(template, columns = template.imageColumns || this.columns) {
    this.columns = columns;

    template = Object.assign(template);

    if ("singletonMode" in template) {
      this.singletonMode = template.singletonMode;
      delete template.singletonMode;
    }

    if ("imageColumns" in template) {
      delete template.imageColumns;
    }

    this._tiles = [];
    this.images = {};

    let defaultSize;
    for (let k in template) {
      let idef = template[k];
      if (idef.size) {
        defaultSize = new Vector2(idef.size);
      }
    }

    let i = 0;
    for (let k in template) {
      let idef = Object.assign({}, template[k]);
      if (!idef.name) {
        idef.name = k;
      }
      if (idef.size === undefined && idef.dimen) {
        idef.size = [idef.dimen, idef.dimen];
      }

      let tile = ImageTile.fromImageItem(idef);
      if (!("size" in idef) && defaultSize) {
        tile.size.load(defaultSize);
      }

      tile.image = new ImageData(tile.size[0], tile.size[1]);
      let idata = tile.image.data;

      /* Set alpha to 255.*/
      for (let i = 0; i < idata.length; i += 4) {
        idata[i + 3] = 255;
      }

      let idname = tile.name.replace(/[ \t\-]/g, "_");
      tile.id = i++;
      tile.enumkey = idname;

      this._tiles.push(tile);
      this.images[k] = tile.image;
    }

    this.layoutTiles();
    this.checkApiStruct();

    console.log("_enabled_images", this._enabled_images);

    /* Restore saved image visibiliy state. */
    if (this._enabled_images !== undefined) {
      this.enabled_images = this._enabled_images;
      delete this._enabled_images;
    }
  }

  layoutTiles() {
    let maxsize = new Vector2();

    for (let tile of this._tiles) {
      maxsize.max(tile.size);
    }

    let pad = 5;
    maxsize.addScalar(pad);

    let x = pad, y = pad;
    let col = 0;

    for (let tile of this._tiles) {
      tile.pos.loadXY(x, y);

      if (this.singletonMode) {
        continue;
      }

      if (col === this.columns - 1) {
        x = pad;
        y += maxsize[1];
      } else {
        x += maxsize[0];
      }

      col++;
    }
  }

  draw(canvas, g) {
    this.checkApiStruct();

    if (!this.visible) {
      return;
    }

    for (let tile of this._tiles) {
      if (tile.enabled) {
        g.putImageData(tile.image, tile.pos[0], tile.pos[1]);
      }
    }
  }
}

DataModel.register(ImageWrangler);

