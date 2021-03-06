
/**
 * Experimental import that patches elements that interacts with Shady DOM 
 * such that tree traversal and mutation apis act like they would under
 * Shadow DOM.
 *
 * This import enables interaction with Shady DOM powered custom elements mostly
 * without the need to use `Polymer.dom` and can therefore enable better 
 * interoperation with 3rd party code, libraries, and frameworks that use DOM
 * tree manipulation apis.
 */
(function() {
  var baseFinishDistribute = Polymer.Base._finishDistribute;
  // NOTE: any manipulation of a node must occur in a patched parent
  // so that the parent can cleanup the node's composed and logical 
  // information. We patch an element's parent's to make this rule more 
  // likely to be satisfied.
  // Also note that any use of qS/qSA must be done in a patched node.
  Polymer.Base._finishDistribute = function() {
    baseFinishDistribute.call(this);
    if (!this.__patched) {
      Polymer.dom(this);
      Polymer.dom(this.root);
      Array.prototype.forEach.call(this.childNodes, function(c) {
        Polymer.dom(c);
      });
      // TODO(sorvell): ensure top element's parents are wrapped (helped A2
      // since it uses qSA on the fragment containing stamped custom elements)
      // note that getOwnerRoot will patch all parents but there should be an 
      // explicit easier way to do this. 
      if (!this.dataHost) {
        Polymer.dom(this).getOwnerRoot();
      }
    }
  };
  var saveLightChildrenIfNeeded = Polymer.DomApi.saveLightChildrenIfNeeded;
  var getComposedChildren = Polymer.DomApi.getComposedChildren;
  var nativeShadow = Polymer.Settings.useShadow;
  var excluded = ['head'];
  Polymer.telemetry.patched = 0;
  
  // experimental: support patching selected native api.
  Polymer.DomApi.ctor.prototype.patch = function(force) {
    if (nativeShadow || this.node.__patched || 
      (this.node.localName && excluded.indexOf(this.node.localName) >= 0)) {
      return;
    }
    getComposedChildren(this.node);
    saveLightChildrenIfNeeded(this.node);
    if (!this.node._lightParent) {
      this.node._lightParent = this.node.parentNode;
    }
    if (!this.node._composedParent) {
      this.node._composedParent = this.node.parentNode;
    }
    // TODO(sorvell): correctly patch non-element nodes.
    if (this.node.nodeType !== Node.TEXT_NODE) {
      this.node.__patched = true;
      patchImpl.patch(this.node);
    }
  };
  Polymer.DomApi.ctor.prototype.unpatch = function() {
    this.flush();
    patchImpl.unpatch(this.node);
  };
  Polymer.DomApi.ctor.prototype.remove = function() {
    this.parentNode.removeChild(this.node);
    this.flush();
    this.unpatch();
  };
  var log = false;
  var factory = Polymer.DomApi.factory;
  var patchImpl = {
    
    hasPrototypeDescriptors: Boolean(Object.getOwnPropertyDescriptor(
      Node.prototype, 'textContent')),
    
    methods: ['appendChild', 'insertBefore', 'removeChild', 'replaceChild',
      'querySelector', 'querySelectorAll', 'getDestinationInsertionPoints', 
      'cloneNode', 'importNode'],
    // <content>: getDistributedNodes
    accessors: ['parentNode', 'childNodes', 
      'firstChild', 'lastChild', 'nextSibling', 'previousSibling',
      'parentElement', 'children',
      'firstElementChild', 'lastElementChild', 
      'nextElementSibling', 'previousElementSibling'
    ],
    writableAccessors: ['textContent', 'innerHTML'],
    protoCache: {},
    
    patch: function(node) {
      Polymer.telemetry.patched++;
      log && console.warn('patch node', node);
      if (this.hasPrototypeDescriptors) {
        this.patchPrototype(node);
      } else {
        this.patchObject(node, true);
      }
    },
    patchPrototype: function(node) {
      var name = node.is || (node.getAttribute && node.getAttribute('is')) ||
        node.localName || node.nodeType;
      var proto = this.protoCache[name];
      if (!proto) {
        proto = this.protoCache[name] = this.createPatchedPrototype(node);
      }
      node.__proto__ = proto;
    },
    createPatchedPrototype: function(node) {
      var sourceProto = node.__proto__;
      var newProto = Object.create(sourceProto);
      newProto.__sourceProto__ = sourceProto;
      this.patchObject(newProto);
      return newProto;
    },
    patchObject: function(obj, cacheAccesors) {
      this.methods.forEach(function(m) {
        this.patchMethod(obj, m);
      }, this);
      this.accessors.forEach(function(n) {
        this.patchAccessor(obj, n, false, cacheAccesors);
      }, this);
      this.writableAccessors.forEach(function(n) {
        this.patchAccessor(obj, n, true, cacheAccesors);
      }, this);
    },
    patchMethod: function(obj, name) {
      var orig = obj[name];
      obj['_$' + name + '$_'] = orig;
      obj[name] = function() {
        log && console.log(this, name, arguments);
        return factory(this)[name].apply(this.__domApi, arguments);
      };
    },
    patchAccessor: function(obj, name, writable, shouldCache) {
      if (shouldCache) {
        this.cacheAccessor(obj, name);
      }
      var info = {
        get: function() {
          log && console.log(this, name);
          return factory(this)[name];
        },
        configurable: true
      };
      if (writable) {
        info.set = function(value) {
          factory(this)[name] = value;
        };
      }
      Object.defineProperty(obj, name, info);
    },
    cacheAccessor: function(obj, name) {
      var cache = obj.__descriptorCache = obj.__descriptorCache || {};
      cache[name] = Object.getOwnPropertyDescriptor(obj, name);
    },
    unpatch: function(obj) {
      if (obj.__sourceProto__) {
        obj.__proto__ = obj.__sourceProto__;
      } else {
        this.methods.forEach(function(m) {
          this.unpatchMethod(obj, m);
        }, this);
        this.accessors.forEach(function(n) {
          this.unpatchAccessor(obj, n);
        }, this);
        this.writableAccessors.forEach(function(n) {
          this.unpatchAccessor(obj, n);
        }, this);
      }
      obj.__patched = false;
    },
    unpatchMethod: function(obj, name) {
      delete obj[name];
    },
    unpatchAccessor: function(obj, name) {
      var info = obj.__descriptorCache[name];
      Object.defineProperty(obj, name, info);
    }
    
  };
  Polymer.DomApi.getLightChildren = function(node) {
    var children = node._lightChildren;
    return children ? children : Polymer.DomApi.getComposedChildren(node);
  }
  Polymer.Base.instanceTemplate = function(template) {
    var m = document._$importNode$_ || document.importNode;
    var dom =
      m.call(document, template._content || template.content, true);
    return dom;
  }
  Polymer.DomApi.patchImpl = patchImpl;
})();
