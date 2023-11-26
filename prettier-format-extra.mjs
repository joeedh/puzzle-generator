console.log("Plugin imported!");

import {doc} from "prettier";
import * as acorn from 'acorn';
import * as acorn_walk from 'acorn-walk';

let acornOptions = {
  ecmaVersion       : "latest",
  sourceType        : "module",
  allowReserved     : true,
  locations         : true,
  onComment         : [],
  preserveParens    : true,
  checkPrivateFields: false,
};

function arrayRemove(list, item) {
  let i = list.indexOf(item);
  if (i < 0) {
    throw new Error("item not in list");
  }

  while (i < list.length) {
    list[i] = list[i + 1];
    i++;
  }

  list.length--;
  return list;
}

class SourceFile {
  constructor(buf) {
    this.lexdata = buf;
    this.lines = buf.split("\n");
    this.comments = [];
    this.objlits = [];
  }

  slice(a, b) {
    return this.lexdata.slice(a, b);
  }
}

let source;

const {join, line, ifBreak, group} = doc.builders;

function makeProxy(obj) {
  return obj;
  return new Proxy(obj, {
    get(target, prop, rec) {
      console.log("get", prop);
      return target[prop];
    },
    set(target, prop, value) {
      console.log("set", prop);
      target[prop] = value;
      return true;
    },
    has(target, prop) {
      console.log("has", prop);
      return prop in target;
    },
    ownKeys(target) {
      console.log("ownKeys");
      return Reflect.ownKeys(target);
    },
  });
}

const languages = [makeProxy({
      name      : "JavaScript",
      parsers   : ["babel", "babel-ts", "acorn", "flow"],
      extensions: ['.js', '.mjs', '.cjs'],
    }
)]

class ASTPath {
  constructor(path) {
    this.path = path;
  }

  // Temporarily push properties named by string arguments given after the
  // callback function onto this.stack, then call the callback with a
  // reference to this (modified) AstPath object. Note that the stack will
  // be restored to its original state after the callback is finished, so it
  // is probably a mistake to retain a reference to the path.
  call(callback, ...names) {
    return this.path.call(callback, ...names);
  }

  callParent(callback, extraSteps = 0) {
    return this.path.callParent(callback, extraSteps);
  }

  // Similar to AstPath.prototype.call, except that the value obtained by
  // accessing this.getValue()[name1][name2]... should be array. The
  // callback will be called with a reference to this path object for each
  // element of the array.
  each(callback, ...names) {
    return this.path.each(callback, ...names);
  }

  // Similar to AstPath.prototype.each, except that the results of the
  // callback function invocations are stored in an array and returned at
  // the end of the iteration.
  map(callback, ...names) {
    return this.path.map(callback, ...names);
  }
}

let indent = (n) => {
  let s = ''
  for (let i = 0; i < n; i++) {
    s += '  ';
  }
  return s;
};

function formatObjLit(code, tab_level=2) {
  console.log(code);

  let source = new SourceFile("a = " + code);
  acornOptions.onComment = source.comments;

  console.log("yay");
  let ast = acorn.parse(source.lexdata, acornOptions);

  ast = ast.body[0].expression.right;

  let out = '';

  class Handlers {
    stack = [];
    state = {
      tlvl: tab_level
    };
    code = "";

    constructor() {

    }

    out(s) {
      this.code += s;
    }

    visit(node) {
      console.log("-", node.type);
      if (this[node.type] !== undefined) {
        this[node.type](node);
      } else {
        this.out(source.lexdata.slice(node.start, node.end));
      }
    }

    Identifier(node) {
      this.out(node.name)
    }

    Literals(node) {
      this.out(node.raw);
    }

    test(node) {
      let code = this.code;
      this.code = ""

      this.visit(node);

      let ret = this.code;
      this.code = code;

      return ret;
    }

    ObjectExpression(node) {
      console.log(node.loc);

      this.state.tlvl++;

      let singleLine = node.loc.start.line === node.loc.end.line
      let nl = singleLine ? '' : "\n";
      let tab = singleLine ? "" : indent(this.state.tlvl);

      this.out("{" + nl);

      let first = true;

      let maxp = 0;
      let propnames = [];
      for (let prop of node.properties) {
        let name = this.test(prop.key);
        maxp = Math.max(maxp, name.length);
        prop.keyStr = name;
      }

      for (let prop of node.properties) {
        if (!first) {
          this.out("," + (singleLine ? " " : "\n"));
        }
        this.out(tab);
        this.visit(prop.key);

        if (!singleLine) {
          for (let i = prop.keyStr.length; i < maxp; i++) {
            this.out(" ");
          }
        }
        this.out(": ")
        this.visit(prop.value);
        first = false;
      }

      if (!singleLine) {
        this.out("\n");
        this.out(indent(this.state.tlvl - 1));
      }

      this.out("}");

      this.state.tlvl--;
    }

    push() {
      this.stack.push(Object.assign({}, this.state));
    }

    pop() {
      this.state = this.stack.pop();
    }
  }

  let h = new Handlers();
  h.visit(ast);

  //console.log(h.code);
  //process.exit();
  return h.code;
}

class Printer {
  path = "";
  options = {};
  print = null;
  stack = [];
  last_start = 0;
  last_end = 0;

  constructor() {
    this._print = this._print.bind(this);
  }

  push() {
    this.stack.push([this.path, this.print, this.options]);
  }

  pop() {
    [this.path, this.print, this.options] = this.stack.pop();
  }

  _print(path, options, printer) {
    //console.trace();
    //process.exit();
    this.push();

    this.path = path;
    this.print = printer;
    this.options = options;

    let node = path.getValue();
    console.log(node.type);

    if (this.last_end < node.start) {

    }

    let ret;
    if (this[node.type]) {
      ret = this[node.type](path);
    } else {
      ret = source.slice(node.start, node.end);
    }

    this.last_start = node.start;
    this.last_end = node.end;

    this.pop();
    return ret;
  }

  Program(path) {
    return path.map(this.print, "body");
  }

  Identifier(path) {
    return path.getValue().name;
  }

  Literal(path) {
    return path.getValue().raw;
  }

  ExpressionStatement(path) {
    return path.call(this.print, "expression");
  }

  ImportExpression(path) {
    let node = path.getNode();
    return source.slice(node.start, node.end) + "\n";
  }

  ImportDeclaration(path) {
    let node = path.getNode();
    return source.slice(node.start, node.end) + "\n";
  }
}

let printers = {
  'estree': {
    print(path, options, printer) {
      let p = new Printer();

      let s = Array.from(source.lexdata);

      let objmap = new Array(source.lexdata.length);

      for (let obj of source.objlits) {
        for (let i = obj.start; i < obj.end; i++) {
          if (objmap[i]) {
            let old = objmap[i];
            if (old.start < obj.start) {
              continue;
            }
          }

          objmap[i] = obj;
        }
      }

      let roots = new Set();

      for (let obj of objmap) {
        if (obj !== undefined) {
          roots.add(obj);
        }
      }

      for (let obj of roots) {
        let code = "";
        for (let i = obj.start; i < obj.end; i++) {
          code += s[i];
          s[i] = undefined;
        }

        code = formatObjLit(code);

        s[obj.start] = {code};
      }

      let out = '';
      for (let i = 0; i < s.length; i++) {
        let c = s[i];
        if (typeof c === "string") {
          out += c;
        } else if (typeof c === "object") {
          out += c.code;
        }
      }

      return out;
      //return p._print(path, options, printer);
    }
  }
}

let parsers = {
  "babel": {
    locStart(node) {
      return node.start;
    },
    locEnd(node) {
      return node.end;
    },
    parse(text, options) {
      source = new SourceFile(text);

      acornOptions.onComment = source.comments;
      console.log("yay");
      let ret = acorn.parse(text, acornOptions);

      let commentmap = new Array(source.lexdata.length);
      let cmap = new Map();
      let visit = new WeakSet();

      for (let c of source.comments) {
        console.log(c);
        for (let i = c.start; i < c.end; i++) {
          commentmap[i] = c;
        }
      }

      let first = true;


      acorn_walk.full(ret, (node, state, options) => {
        let visit2 = new WeakSet();

        if (node.type === "Program") {
          return;
        }

        console.log(node.type);
        if (node.type === "ObjectExpression") {
          source.objlits.push(node);
        }
      });

      return ret;
    },
    astFormat: "estree",
  }
};
export default makeProxy({
  languages,
  options : {
    example: {
      type       : "boolean",
      category   : "Global",
      default    : false,
      description: "example option"
    }
  },
  parsers : makeProxy(parsers),
  printers: makeProxy(printers)
});

