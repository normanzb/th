/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1
 *
 * The contents of this file are subject to the Mozilla Public License
 * Version 1.1 (the "License"); you may not use this file except in
 * compliance with the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS"
 * basis, WITHOUT WARRANTY OF ANY KIND, either express or implied.
 * See the License for the specific language governing rights and
 * limitations under the License.
 *
 * The Original Code is Bespin.
 *
 * The Initial Developer of the Original Code is Mozilla.
 * Portions created by the Initial Developer are Copyright (C) 2009
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Bespin Team (bespin@mozilla.com)
 *
 * ***** END LICENSE BLOCK ***** */

//= require "css"
//= require "traits"
    
if (typeof th == "undefined") th = {};

/*
 * Constants
 */
th.VERTICAL = "vertical";
th.HORIZONTAL = "horizontal";

// ** {{{ Resources }}} **
//
// Loads those resources that are shared with all Scenes on the same page, like CSS and layout information.
// Typically there is no need to instantiate this class; a Scene will do it automatically. However, for performance, you may
// wish to eagerly instantiate an instance to request resources earlier in the page realization process.
th.Resources = Class.define({
    members: {
        init: function() {
            this.loading = false;

            // an array containing objects that correspond to each matching stylesheet in the order specified
            this.userAgentCss = [];
            this.authorCss = [];
            this.userCss = [];

            // caches
            this.resolvedCssCache = {};

            this.blockUntilImagesLoaded = true;

            // images
            this.images = {};

            // used during the CSS loading process; due to callbacks, this is pushed top-level so it can be shared across functions
            this.sheetCount = 0;
            this.currentSheet = 0;

            // used during image loading process
            this.imageCount = 0;
            this.currentImage = 0;

            this.loaded = false;    // are all the resources loaded, including CSS and other stuff?
            this.cssLoaded = false; // are all the CSS sheets loaded?
            this.imagesLoaded = false;  // are all the images references by the CSS loaded?

            this.callbacks = [];
        },

        load: function(baseUrl, stringStyles) {
            if (this.loaded) return;    // no re-loading

            this.baseUrl = baseUrl;
            this.stringStyles = stringStyles;
            this.loading = true;
            this.parseCSS();
        },

        processImage: function() {
            this.currentImage++;
            if (this.imageCount == this.currentImage) {
                this.imagesLoaded = true;
                this.onLoaded();
            }
        },
        
        loadImages: function(properties, resourceBase) {
            var urlFoundPos, endOfUrlPos, image;
            
            for (var property in properties) {
                var value = properties[property];

                if ((urlFoundPos = value.indexOf("url(")) != -1) {
                    endOfUrlPos = value.indexOf(")", urlFoundPos);
                    if (endOfUrlPos == -1) {
                        console.log("Warning: malformed url found ('" + value + "')");
                        break;
                    }

                    var cacheUrl = value.substring(urlFoundPos, endOfUrlPos);
                    var basicUrl = cacheUrl + ')';
                    var url = cacheUrl.substring(4);
            
                    // kill any quotes surrounding the url
                    if (url.charAt(0) == "'" || url.charAt(0) == "\"") {
                        url = url.substring(1, url.length - 1);
                    }

                    // the base URL is not the right play here, this points to Thunderhead's base, not the current page
                    // commenting out for now
                    //if (this.baseUrl) url = this.baseUrl + url;
                    
                    if (this.images[basicUrl] !== undefined) {
                        // the image is already there, go on
                        continue;
                    }
                    
                    this.imageCount++;
                    image = new Image();

                    if (this.blockUntilImagesLoaded) {
                        this.imagesLoaded = false;
                        var self = this;
                        image.onload = function() {
                            self.processImage();
                        }
                        image.onerror = function() {
                            self.processImage();
                        }
                    }

                    if (resourceBase == undefined) resourceBase = "";
                    image.src = resourceBase + url;
                    this.images[basicUrl] = image;
                }
            }
        },

        onLoaded: function() {
            if (this.cssLoaded && ((this.blockUntilImagesLoaded && this.imagesLoaded) || !this.blockUntilImagesLoaded)) {
                this.loaded = true;
                this.loading = false;
                if (this.callbacks) {
                    th.forEach(this.callbacks, function(item) {
                        // check if there is context; if so, execute the callback using the context
                        if (item.context) {
                            item.callback.apply(item.context);
                        } else {
                            item.callback();
                        }
                    });
                }
            }
        },

        registerOnLoadCallback: function(callback, context) {
            this.callbacks.push({ callback: callback, context: context });
        },

        parseCSS: function() {
            var links = [];

            var usedStringifiedDefault = false;

            // add default stylesheet via path if baseUrl provided
            if (typeof this.baseUrl !== "undefined") {
                links.push({ url: this.baseUrl + "css/default.css", resourceBase: this.baseUrl, array: this.userAgentCss, index: 0 });
            } else if (th.DEFAULT_CSS) {
                this.processCSS(th.DEFAULT_CSS, undefined, this.userAgentCss, 0);
                usedStringifiedDefault = true;
            }

            var s, l = document.getElementsByTagName('link');
            var counter = 0;
            for (var i=0; i < l.length; i++){
                s = l[i];
                if (s.rel.toLowerCase().indexOf('thstylesheet') >= 0 && s.href) {
                    // fixme: the resource base url should be computed from the url of the referenced stylesheet;
                    // I'm too lazy to do this right now, so by setting to undefined it becomes the page's url, which I'm
                    // hoping is generally acceptable
                    links.push({ url: s.href, resourceBase: undefined, array: this.authorCss, index: counter++ });
                }
            }

            // an optional string representation of a stylesheet can be provided; if present, parse it
            if (this.stringStyles) {
                this.processCSS(this.stringStyles, this.authorCss, counter++);
            }
            
            // this shouldn't happen; we should always have at least one userAgentCss otherwise things are going to be mighty sparse
            if (links.length == 0) {
                this.cssLoaded = true;
                return this.onLoaded();
            }

            this.sheetCount = links.length;
            if (usedStringifiedDefault) this.sheetCount++;
            if (this.stringStyles) this.sheetCount++;

            th.forEach(links, function(link) {
                th.xhrGet({
                    url: link.url,

                    load: function(response) {
                        this.processCSS(response, link.resourceBase, link.array, link.index);
                    },
                    context: this
                });
            }, this);
        },

        processCSS: function(stylesheet, resourceBase, array, index) {
            array[index] = new th.CssParser().parse(stylesheet);
            
            for (var rule in array[index]) {
                // populate a separate array with the property names because we muck about with the rule as we iterate through
                // the set of properties; to avoid weird issues where new property name iteration doesn't work quite right, we
                // do this in a separate pass
                var expandedProperties = {};
                for (var property in array[index][rule]) {
                    th.expandCssProperty(property, array[index][rule][property], expandedProperties);
                }
                
                array[index][rule] = expandedProperties;

                // load
                this.loadImages(expandedProperties, resourceBase);
            }

            if (++this.currentSheet == this.sheetCount) {
                this.cssLoaded = true;
                this.onLoaded();
            }
        }
    }
});

/*
    Timer Manager; allows to start and restart timers as well as stop them again
*/
th.Timer = Class.define({
    members: {
        init: function() {
            this.timer = {};
        },
        
        start: function(name, func, delay, source) {
            var now = new Date();
            if (this.timer[name] && this.timer[name].end > now) {
                clearTimeout(this.timer[name].obj);
            }
            this.timer[name] = {
                obj: th.delay(func, delay, source),
                end: (now + delay)
            };
        },
        
        stop: function(name) {
            if (!this.timer[name])  return;
            if (this.timer[name].end > new Date()) {
                clearTimeout(this.timer[name].obj);
            }
            delete this.timer[name];
        }
    }
});

/*
    Event bus; all listeners and events pass through a single global instance of this class.
 */
th.Bus = Class.define({
    members: {
        init: function() {
            // map of event name to listener; listener contains a selector, function, and optional context object
            this.events = {};
        },


        // register a listener with an event
        // - event: string name of the event
        // - selector:
        bind: function(event, selector, listenerFn, listenerContext) {
            var listeners = this.events[event];
            if (!listeners) {
                listeners = [];
                this.events[event] = listeners;
            }
            selector = th.isArray(selector) ? selector : [ selector ];
            for (var z = 0; z < selector.length; z++) {
                for (var i = 0; i < listeners.length; i++) {
                    if (listeners[i].selector == selector[z] && listeners[i].listenerFn == listenerFn) return;
                }
                listeners.push({ selector: selector[z], listenerFn: listenerFn, context: listenerContext });
            }
        },

        // removes any listeners whose selectors have the *same identity* as the passed selector
        unbind: function(selector) {
            for (var event in this.events) {
                var listeners = this.events[event];

                for (var i = 0; i < listeners.length; i++) {
                    if (listeners[i].selector === selector) {
                        this.events[event] = th.remove(listeners, listeners[i]);
                        listeners = this.events[event];
                        i--;
                    }
                }
            }
        },

        // notify all listeners of an event
        fire: function(eventName, eventDetails, component) {
            var listeners = this.events[eventName];
            if (!listeners || listeners.length == 0) return;

            // go through each listener registered for the fired event and check if the selector matches the component for whom
            // the event was fired; if there is a match, dispatch the event
            for (var i = 0; i < listeners.length; i++) {
                // if the listener selector is a string...
                if (listeners[i].selector.constructor == String) {
                    // check if the string starts with a hash, indicating that it should match by id
                    if (listeners[i].selector.charAt(0) == "#") {
                        if (component.id == listeners[i].selector.substring(1)) {
                            this.dispatchEvent(eventName, eventDetails, component, listeners[i]);
                        }
                    // otherwise check if it's the name of the component class
                    } else if (listeners[i].selector == component.declaredClass) {
                        this.dispatchEvent(eventName, eventDetails, component, listeners[i]);
                    }
                // otherwise check if the selector is the current component
                } else if (listeners[i].selector == component) {
                    this.dispatchEvent(eventName, eventDetails, component, listeners[i]);
                }
            }
        },

        // invokes the listener function
        dispatchEvent: function(eventName, eventDetails, component, listener) {
            eventDetails.thComponent = component;

            // check if there is listener context; if so, execute the listener function using that as the context
            if (listener.context) {
                listener.listenerFn.apply(listener.context, [ eventDetails ]);
            } else {
                listener.listenerFn(eventDetails);
            }
        }
    }
});

/*
    FocusManager; handles focusing stuff
 */

th.FocusManager = Class.define({
    members: {
        bus: null,

        KEY_TAB: 9,
        C: 67,
        V: 86,
        X: 88,

        init: function (eventBus, domInputFirst, domInputLast) {
            this.bus = eventBus;
            this.subscribers = [];
            this.focused = undefined; // the current focused candicate
            this.focusedIndex = -1; // index of this.focused in this.subscribers
            this.domInputFirst = domInputFirst;
            this.domInputLast = domInputLast;
            this.domHasFocus = undefined;   // can be undfined if no input is focused or domInputFirst | domInputLast
            this.ignoreDomEvent = false;
            
            // insert dummy text, so that copy works
            this.domInputFirst.value = '<norealtext>';
            this.domInputLast.value = '<norealtext>';
            
            // bind the events
            // why can't I do this with th.forEach???
            var inputs = [this.domInputFirst, this.domInputLast];
            for (var i=0; i < 2; i++) {
                th.observe(inputs[i], "focus", !i ? this.enterFirst : this.enterLast, this);
                th.observe(inputs[i], "blur", this.domFocusLost, this);
                th.observe(inputs[i], "keydown", this.handleKeyDown, this);
                th.observe(inputs[i], "keypress", this.handleKeyPress, this);
                th.observe(inputs[i], "keyup", this.handleKeyUp, this);                
            }
            
            // non Webkit browsers handle this within handleKeyDown
            if (th.browser.WebKit) {
                th.observe(document, "cut", this.handleCut, this);
                th.observe(document, "copy", this.handleCopy, this);
                th.observe(document, "paste", this.handlePaste, this);                
            }
        },
        
        relateTo: function(scene) {
            this.relateTo = scene.canvas;
            var x = th.cumulativeOffset(this.relateTo).left + 10;
            var y = th.cumulativeOffset(this.relateTo).top + 10;
            this.domInputFirst.style.position = 'absolute';
            this.domInputLast.style.position = 'absolute';
            this.domInputFirst.style.width = '10px';
            this.domInputLast.style.width = '10px';
            // changing the z-index is not taken in account within Firefox! => got to do this within the html-file...
            this.domInputFirst.style['z-index'] = '-100';
            this.domInputLast.style['z-index'] = '-100';
            if (this.relateTo.style.display == 'none') this.toggleInputs({ isVisible: false });
            this.moveInputs({x: x, y: y});
            
            this.bus.bind("move", scene, this.moveInputs, this);
            this.bus.bind("toggle", scene, this.toggleInputs, this);
        },
        
        toggleInputs: function(e) {
            var value = e.isVisible ? 'block' : 'none';
            this.domInputFirst.style.display = value;
            this.domInputLast.style.display = value;            
        },
        
        moveInputs: function(newPos) {
            this.domInputFirst.style.top = (newPos.y + 50) + 'px';
            this.domInputLast.style.top = (newPos.y + 50) + 'px';
            this.domInputFirst.style.left = (newPos.x + 50) + 'px';
            this.domInputLast.style.left = (newPos.x + 65) + 'px';
        },
        
        focusWithinManager: function() {
            return this.focused !== undefined && this.domHasFocus !== undefined;
        },

        performCopy: function (e, text) {
            if (e.clipboardData !== undefined) {
                // this is for webkit: can copy the text directly to the clipboard
                e.clipboardData.setData('text/plain', text);
                th.stopEvent(e);
            } else {
                // this is for non webkit: copy the text into the input fields and select it
                this.domHasFocus.value = text;
                this.domHasFocus.select();
            }
        },
        
        handleCopy: function (e) {
            if (!this.focusWithinManager()) return;

            if (th.isFunction(this.focused.performCopy)) {
                var result = this.focused.performCopy();
                if (!result) {
                    th.stopEvent(e);
                    return;
                } else {
                    this.performCopy(e, result);
                }
            }
        },
        
        handlePaste: function(e) {
            if (!this.focusWithinManager()) return;

            if (th.isFunction(this.focused.performPaste)) {
                if (e.clipboardData !== undefined) {
                    this.focused.performPaste(e.clipboardData.getData('text/plain'));                    
                    th.stopEvent(e);
                } else {
                    this.domHasFocus.value = '';
                    th.delay(function() { this.focused.performPaste(this.domHasFocus.value); }, 0, this);
                }
            }
        },

        handleCut: function(e) {
            if (!this.focusWithinManager()) return;
            
            if (th.isFunction(this.focused.performCut)) {
                var result = this.focused.performCut();
                if (!result) {
                    th.stopEvent(e);
                    return;
                } else {
                    this.performCopy(e, result);
                }
            }
        },

        enterFirst: function (e) {
            this.domHasFocus = this.domInputFirst;
            this.domInputFirst.select();
            
            if (this.ignoreDomEvent) return;
            if (this.subscribers.length == -1) return;

            this.focus(this.subscribers[0]);
            this.ignoreDomScroll = true;
        },
        
        enterLast: function (e) {
            this.domHasFocus = this.domInputLast;
            this.domInputLast.select();
            
            if (this.ignoreDomEvent) return;
            if (this.subscribers.length == -1) return;
            
            this.focus(th.lastArrayItem(this.subscribers));   

            this.ignoreDomScroll = true;         
        },

        domFocusLost: function (e) {
            if (this.ignoreDomEvent) return;
            
            // the focusManger lost it's focus...
            // 1. check if this is okay
            if (this.focused !== undefined) {
                // check if the component has a function to decide to lose focus or not
                if (th.isFunction(this.focused.allowLoseFocus)) {
                    // give the current focused component the possibility to reveal loosing focus
                    if (!this.focused.allowLoseFocus(e)) {
                        // bring back the focus to the focusManager and focus the former component again
                        this.focus(this.focused);
                        return;
                    }
                }
            }

            // 2. remove the focus
            this.focusedLostFocus();
            delete this.focused;
            delete this.domHasFocus;
            this.focusedIndex = -1;
        },
        
        removeFocus: function() {
            this.focusedLostFocus();
            delete this.focused;
            delete this.domHasFocus;
            this.focusedIndex = -1;
        },
        
        focusedLostFocus: function() {
            if (!this.focused)  return;
            
            this.bus.fire("focus:lost", e, this.focused);
            delete this.focused.pseudoClass;
            this.focused.repaint();
        },
    
        handleKeyDown: function (e) {
            if (!this.focusWithinManager()) return;

            // got to handle tabs!
            if (e.keyCode == this.KEY_TAB && this.subscribers.length != 0) {
                var focusOutOfScene = false;
                if (e.shiftKey == false) {
                    if (this.focused.focusNext === undefined) {
                        this.focusedIndex++;
                        if (this.focusedIndex >= this.subscribers.length) {
                            focusOutOfScene = true;
                        } else {
                            this.focus(this.subscribers[this.focusedIndex]);
                        }
                    } else {
                        this.focus(this.focused.focusNext);
                    }
                } else {
                    if (this.focused.focusPrev === undefined) {
                        this.focusedIndex--;
                        if (this.focusedIndex <= -1) {
                            focusOutOfScene = true;
                        } else {
                            this.focus(this.subscribers[this.focusedIndex]);
                        }                        
                    } else {
                        this.focus(this.focused.focusPrev);
                    }
                }
                if (!focusOutOfScene) {
                    // in this case, the focus travels within the canvas => do not handle browser focus travel!
                    th.stopEvent(e);
                } else {
                    // in this case the focus should go to the next browser controller => just mark the inputs as unfocused and let the keydown event go its way
                    delete this.domHasFocus;
                }
                return;
            }
            
            // handle copy/cut/paste, but only if the browser is not Webkit (as Webkit can do this better)
            if (!th.browser.WebKit && (e.ctrlKey || e.metaKey)) {
                if (e.keyCode == this.C) {
                    this.handleCopy(e);
                    return;
                } else if (e.keyCode == this.X){
                    this.handleCut(e);
                    return
                } else if (e.keyCode == this.V) {
                    this.handlePaste(e);
                    return
                }
            }
            
            e.focusManager = this;
            this.bus.fire("keydown", e, this.focused);
        },
        
        handleKeyPress: function (e) {
            if (!this.focusWithinManager()) return;

            e.focusManager = this;
            this.bus.fire("keypress", e, this.focused);
        },
        
        handleKeyUp: function (e) {
            if (!this.focusWithinManager()) return;
            
            e.focusManager = this;
            this.bus.fire("keyup", e, this.focused);
        },
        
        focus: function (component) {
            var index = this.subscribers.indexOf(component);
            if (index == -1) {
                // no such subscribed component
                console.error('FocusManager:focus: no such subscribed component!');
                return;
            }

            e = {};
            e.newFocused = component;
            e.focusManager = this;
            if (this.focused !== undefined && component !== this.focused) {
                // check if the component has a function to decide to lose focus or not
                if (th.isFunction(this.focused.allowLoseFocus)) {
                    // give the current focused component the possibility to reveal loosing focus
                    if (!this.focused.allowLoseFocus(e)) {
                        this.focusedIndex = this.subscribers.indexOf(this.focused);
                        return false;
                    }                    
                }
            }

            // the focus manager is allowed to change the focus => do so!
            if (this.focused !== undefined) {
                // just unfocus an component, if there was one selected before
                this.focusedLostFocus();
            }

            this.focusedIndex = index;
            this.focused = component;

            this.bus.fire("focus:received", e, this.focused);
            this.focused.pseudoClass = 'active';
            this.focused.repaint();

            if (this.focusedIndex == this.subscribers.length - 1) {    
                this.ignoreDomEvent = true;
                this.domInputLast.focus();
                this.ignoreDomEvent = false;    
            } else if (this.focusedIndex == 0 || this.domHasFocus === undefined) {
                this.ignoreDomEvent = true;
                this.domInputFirst.focus();
                this.ignoreDomEvent = false;
            }

            return true;
        },

        subscribe: function (components, scene) {
            if (!th.isArray(components))    components = [ components ];
            
            for (var i = 0; i < components.length; i++) {
                if (th.isString(components[i])) {
                    if (scene === undefined) {
                        console.error('I have to know a scene, if I should get a component by its id!');
                        return;
                    }
                    components[i] = scene.byId(components[i]);
                    if (components[i] === undefined) {
                        console.error('Could not find component by id "' + components[i].id + '")');
                        return;
                    }
                }
                if (!this.hasSubscriber(components[i])) {
                    this.subscribers.push(components[i]);
                    components[i].focusManager = this;
                }
            }
        },
                
        hasSubscriber: function (component) {
            return (this.subscribers.indexOf(component) != -1);
        },

        unsubscribe: function (component) {
            var index = this.subscribers.indexOf(components);
            if (index == -1) {
                console.error('FocusManager:unsubscribe: no such subscribed component!');
                return;
            }
            // if item is subscribed, remove it from the list
            this.subscribers.splice(index, 1);
            if (index == this.focused) {
                // if item focused dispatch a lost-focus event
                this.bus.fire("focus:lost", {}, component);
                delete component.focusManager;
                this.focused = -1;
            }
        },

        hasFocus: function (component) {
            return (component === this.focused);
        }
    }
});

// create the global event bus
th.global_event_bus = new th.Bus();

// create the global resource loader
th.global_resources = new th.Resources();

// create the global scene array
th.global_scene_array = new Array();

// create the global timer object
th.global_timer = new th.Timer();

th.Scene = Class.define({
    uses: [
        th.EventHelpers
    ],

    members: {
        bus: th.global_event_bus,

        init: function(canvasOrId, baseUrlOrParams, createFocusManager) {
            if (th.isString(canvasOrId)) {
                canvasOrId = document.getElementById("canvasOrId");
            }
            this.canvas = canvasOrId;
            this.id = this.canvas.id;

            var baseUrl = baseUrlOrParams;
            var stringStyles = "";
            if (baseUrlOrParams && !th.isString(baseUrlOrParams)) {
                baseUrl = baseUrlOrParams.baseUrl;
                stringStyles = baseUrlOrParams.stringStyles;
            }

            // setup the focusManager, if we want to do this
            if (createFocusManager) {
                // create two textareas for the fake focus traveling
                var inputs = [];
                var inputAttrStyle;
                var inputAttrRow;
                for (var i=0; i < 2; i++) {
                    inputs[i] = document.createElement("input");
                    inputAttrStyle = document.createAttribute("style");
                    inputAttrStyle.nodeValue = 'z-index: -100';
                    inputAttrRow = document.createAttribute("rows");
                    inputAttrRow.nodeValue = '10';
                    inputs[i].setAttributeNode(inputAttrStyle);
                    inputs[i].setAttributeNode(inputAttrRow);
                    this.canvas.parentNode.insertBefore(inputs[i], this.canvas);
                }
                                
                this.focusManager = new th.FocusManager(th.global_event_bus, inputs[0], inputs[1]);
                this.focusManager.relateTo(this);
            }

            // whether this scene completely repaints on each render or does something smarter. this is experimental.
            this.smartRedraw = false;

            // aliasing global resources to be a member; not yet clear how components will typically get access to resources, whether
            // through scene or the global
            this.resources = th.global_resources;

            // has this scene registered a render callback? this is done if render() invoked before resources are all loaded
            this.resourceCallbackRegistered = false;

            // if the resource loading process hasn't started, start it!
            if (!this.resources.loaded && !this.resources.loading) this.resources.load(baseUrl, stringStyles);

            th.observe(window, "resize", function() {
                this.render();
            }, this);

            this.root = new th.Panel({ id: this.id });
            this.root.scene = this;

            this.testCanvas = document.createElement("canvas");
            this.scratchContext = this.testCanvas.getContext("2d");
            th.fixCanvas(this.scratchContext);

            this.parseTags();
            
            th.global_scene_array.push(this);
            
            // add eventlistener to the scene / the underlaying dom-canvas
            th.observe(this.canvas, "mousedown", function(e) {
                this.wrapEvent(e, this.root);

                this.mouseDownComponent = e.thComponent;

                th.global_event_bus.fire("mousedown", e, e.thComponent);
            }, this);
            
            th.observe(window, "mouseup", function(e) {
                if (!this.mouseDownComponent) return;
            
                this.wrapEvent(e, this.root);
                
                e.isOverMe = (e.thComponent === this.mouseDownComponent);
                th.global_event_bus.fire("mouseup", e, this.mouseDownComponent);   

                delete this.mouseDownComponent;
            }, this);

            th.observe(this.canvas, "dblclick", function(e) {
                this.wrapEvent(e, this.root);

                th.global_event_bus.fire("dblclick", e, e.thComponent);
            }, this);

            th.observe(this.canvas, "contextmenu", function(e) {
                this.wrapEvent(e, this.root);
                th.global_event_bus.fire("contextmenu", e, e.thComponent);
            }, this)

            th.observe(this.canvas, "click", function(e) {
                this.wrapEvent(e, this.root);

                th.global_event_bus.fire("click", e, e.thComponent);
            }, this);

            // first <mousemove>
            // this must be attached to the window, otherwise mouse events stop being sent when the cursor is outside
            // of the bounds of the DOM element (not what we want)
            th.observe(window, "mousemove", function(e) {
                this.wrapEvent(e, this.root)

                if (this.mouseDownComponent) {
                    this.addComponentXY(e, this.root, this.mouseDownComponent);
                    th.global_event_bus.fire("mousedrag", e, this.mouseDownComponent);
                }
            }, this);
            
            // secound <mousemove>
            // this handels the "mousemove", "mouseout" and "mouseover" event and pass them to the component
            // this is *not* within the observer above, as these events depend on the z-level of the canvas on the page.
            // let the browser handle this is much more easier for us.
            th.observe(this.canvas, "mousemove", function(e) {
                this.wrapEvent(e, this.root);

                th.global_event_bus.fire("mousemove", e, e.thComponent);
                                
                if (e.thComponent !== this.mouseOverComponent) {
                    if (this.mouseOverComponent !== undefined) {
                        th.global_event_bus.fire("mouseout", {}, this.mouseOverComponent);                        
                    }    
                    this.mouseOverComponent = e.thComponent;
                    th.global_event_bus.fire("mouseover", {}, this.mouseOverComponent);
                }
            }, this);
            
            th.observe(this.canvas, "mouseout", function(e) {
                if (this.mouseOverComponent) {
                    th.global_event_bus.fire("mouseout", {}, this.mouseOverComponent);
                    delete this.mouseOverComponent;
                }
            }, this);
            
            var scrollFunction = th.hitch(this, function(e) {
                this.wrapEvent(e, this.root);
                var comp = e.thComponent;
                var parent = comp.parent;
                
                while (parent) {
                    if (parent.type == 'ScrollPane') {
                        e.delta = 0;

                        if (e.wheelDelta) { 
                            e.delta = e.wheelDelta/500;
                            if (window.opera) e.delta = -e.delta;
                        } else if (e.detail) {
                            e.delta = -e.detail/15;
                        }

                        if (e.delta && th.isFunction(parent.performScroll)) parent.performScroll(e);
                        break;
                    }
                    parent = parent.parent;
                }
            });
            
            // mhmm, th.observe wasn't working for Firfox, as it changes the event to on<Event>
            // has anyone a better solution for this?
            if (th.browser.Gecko) {
                window.addEventListener('DOMMouseScroll', scrollFunction, false);
            } else {
                th.observe(this.canvas, 'mousewheel', scrollFunction)
            }
        },

        _byId: function(id, children) {
            for (var i = 0; i < children.length; i++) {
                if (children[i].id == id) return children[i];

                if (children[i].children) {
                    var result = this._byId(id, children[i].children);
                    if (result !== undefined) return result;
                }
            }
        },

        byId: function(id) {
            return this._byId(id, this.root.children);
        },

        renderFunc: function(callback) {
            delete this.renderTimer;
            
            // we *have* to remove the whole content of the scene if we want to repaint/render it entirely
            var ctx = this.canvas.getContext("2d");
            th.fixCanvas(ctx);
            ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            
            var oldSmartRedraw = this.smartRedraw;
            this.smartRedraw = true;    // we can set this to true as we cleared the whole scene

            this.layout();
            this.paint();
            this.paintSelf();
            
            this.smartRedraw = oldSmartRedraw;

            // if we got here with the callback param, we need to invoke it directly
            if (callback) {
                callback(this);
            }
        },

        render: function(callback) {
            if (!this.resources.loaded) {
                if (!this.resourceCallbackRegistered) {
                    this.resources.registerOnLoadCallback(this.render, this);
                    if (callback) this.resources.registerOnLoadCallback(function() {
                        callback(this);
                    }, this);
                    this.resourceCallbackRegistered = true;
                }

                return;
            }
            
            // if (this.renderTimer) {
            //      console.debug('want to render...');
            //      clearTimeout(this.renderTimer);
            // }
            // this.renderTimer = setTimeout( th.hitch(this, function() { this.renderFunc(callback); }), 0);
            this.renderFunc(callback);
        },

        // render is non-blocking; for tests, etc., you may want to block until render() finishes
        blockUntilRender: function() {
            if (!this.resources.loaded) {

            }
        },

        // finds any children inside the canvas element and creates matching components 
        parseTags: function() {
            // special parsing for the canvas tag itself
            this.parseCanvasAttributes("grid");
            this.parseCanvasAttributes("flowLayout");

            var children = this.canvas.childNodes;
            this.attachChildElementsToParent(children, this.root);
        },

        parseCanvasAttributes: function() {
            th.forEach(arguments, function(argument) {
                if (this.canvas.hasAttribute(argument)) {
                    this.root[argument] = this.canvas.getAttribute(argument);
                }
            }, this);
        },

        attachChildElementsToParent: function(children, parent) {
            th.forEach(children, function(child) {
                if (child.nodeType == Node.ELEMENT_NODE) {
                    var component = this.createComponentFromElement(child, parent);
                    if (component) {
                        parent.add(component);
                        this.attachChildElementsToParent(child.childNodes, component);
                    } else {
                        console.log("Couldn't create component from element \"" + child.tagName + "\"");
                    }
                }
            }, this);
        },

        createComponentFromElement: function(child, futureParent) {
            var componentMap = {};
            for (var fieldName in th) {
                var lower = fieldName.toLowerCase();
                if (componentMap[lower]) console.log("componentMap collision with key \"" + lower + "\"");
                componentMap[lower] = fieldName;
            }

            var tagName = child.tagName.toLowerCase();

            // check if "th" instance has a field with the component name; if so, let's also check if the "type" field exists
            // with the same name
            fieldName = componentMap[tagName];

            if (!fieldName) return;            // no field that matches the tag name

            var constructor = th[fieldName];
            if (!constructor) return;          // field no longer exists in th; this shouldn't ever happen

            // create an instance of the component, passing the attributes as parameters
            var attr = child.attributes;
            var params = {};
            th.forEach(attr, function(attribute) {
                // the attribute instance is read-only; aliasing the values to variables to permit updating
                var name = attribute.name;
                var value = attribute.value;

                // alias the "cell" attribute to "constraints"; undefined what happens if you specify both cell and constraints
                if (name == "cell") name = "constraints";

                params[name] = value;
            });

            // make sure the component is of the right type
            var potentialComponent = new constructor(params);

            if (!potentialComponent.type) return;       // created instance doesn't have type field and therefore is not a component
            if (potentialComponent.type.toLowerCase() != tagName) return;       // type name doesn't match tag name

            return potentialComponent;
        },

        layout: function() {
            if (this.root) {
                this.root.bounds = { x: 0, y: 0, width: this.canvas.width, height: this.canvas.height };
                this.root.layoutTree();
            }
        },
        
        paintSelf: function(ctx) {},

        paint: function(component) {
            if (!this.resources.loaded) {
                if (!this.resourceCallbackRegistered) {
                    this.resources.registerOnLoadCallback(this.render, this);
                    this.resourceCallbackRegistered = true;
                }
                return;
            }

            if (!component) component = this.root;

            if (component) {
                // if this is root, we need to resolve css
                if (component === this.root) component.resolveCss();

                // if the current component does not claim to be opaque, we need to paint what's behind it first
                if (!component.opaque && component.parent) {
                    return this.paint(component.parent);
                }

                var ctx = this.canvas.getContext("2d");
                th.fixCanvas(ctx);

                ctx.save();

                // the coordinate space is now in terms of the origin of the canvas; we need to change it to be in the coordinate
                // space of the component to be rendered. to do that, we need to walk up the hierarchy from the current component
                // to the root, translating the coordinating space as we go. We'll also establish clipping rectangles as we do
                // this. It's important to include parents as we setup the clip as a component can overflow the bounds of its
                // parent.
                var translateX = 0, translateY = 0;
                
                var parent = component.parent;
                var child = component;
                var paintStack = [];
                while (parent) {
                    paintStack.push(child);
                    if (child.bounds === undefined || child.bounds.x === undefined || child.bounds.y === undefined || child.bounds.width === undefined || child.bounds.height === undefined) {
                        // component not laid out, nothing to repaint
                        return;
                    }
                    translateX += child.bounds.x;
                    translateY += child.bounds.y;

                    child = parent;
                    parent = parent.parent;
                }
                
                if (paintStack.length != 0) {                
                    var c = paintStack.pop();
            
                    // clipping area:
                    //
                    //    x (clipSX/clipSY) --------------------------|
                    //    |                                           |
                    //    |                                           | << clipped area!
                    //    |                                           |
                    //    |                                           |
                    //    |-------------------------------------------x (clipEX/clipEY)
                    //
                
                    // clip the drawing from here ...
                    var clipSX = c.bounds.x;
                    var clipSY = c.bounds.y;
                    // to here. Notice: we use absolute cordinates of the "endpoint" and not just width/height!
                    var clipEX = c.bounds.x + c.bounds.width;
                    var clipEY = c.bounds.y + c.bounds.height;
                
                    var transX = clipSX;
                    var transY = clipSY;
                
                    while (paintStack.length > 0) {
                        c = paintStack.pop();
                        transX += c.bounds.x;
                        transY += c.bounds.y;
                        clipSX = Math.max(clipSX, transX);
                        clipSY = Math.max(clipSY, transY);
                        clipEX = Math.min(clipEX, transX + c.bounds.width);
                        clipEY = Math.min(clipEY, transY + c.bounds.height);
                    }
                
                    ctx.beginPath();
                    ctx.rect(clipSX, clipSY, clipEX - clipSX, clipEY - clipSY);
                    ctx.closePath();
                    ctx.clip();
                } else {
                    ctx.beginPath();
                    ctx.rect(0, 0, component.bounds.width, component.bounds.height);
                    ctx.closePath();
                    ctx.clip();
                }
                
                ctx.translate(translateX, translateY);

                // normally, we start with a clean slate while painting but components can support a "smart redraw" mode wherein
                // they might just change a small part of themselves with each paint
                if (!this.smartRedraw) {
                    ctx.clearRect(0, 0, component.bounds.width, component.bounds.height);
                }

                // render the component...
                component.paint(ctx);

                // ...and the border, too
                if (component.border) component.border.paint(ctx);

                ctx.restore();
            }
        }
    }
});

th.SimpleBorder = Class.define({
    type: "Border",

    uses: [
        th.ComponentHelpers
    ],

    members: {
        init: function (component) {
            this.SIDES = ["top", "right", "bottom", "left"];

            this.component = component;
        },

        getBorderWidth: function(side) {
            var length = this.component.cssValue("border-" + side + "-width");
            if (length === undefined) return 0; // TODO: should be "medium" by default
            return th.convertLengthToPixels(length, this.component);
        },

        getInsets: function() {
            return this.calculateInsets("border-", "-width");
        },

        paint: function(ctx) {
            if (this.component.cssValue("border-image-url") === undefined) {
                this.paintSimpleBorder(ctx)
            } else {
                this.paintImageBorder(ctx);
            }
        },
        
        paintSimpleBorder: function(ctx) {
            for (var i = 0; i < this.SIDES.length; i++) {
                var s = this.SIDES[i];
                var width = this.getBorderWidth(s);
                if (width > 0) {
                    var color = this.component.cssValue("border-" + s + "-color");

                    var x, y, h, w;

                    switch (s) {
                        case "top":
                            x = 0;
                            y = 0;
                            h = width;
                            w = this.component.bounds.width;
                            break;
                        case "right":
                            x = this.component.bounds.width - width;
                            y = 0;
                            h = this.component.bounds.height;
                            w = width;
                            break;
                        case "bottom":
                            x = 0;
                            y = this.component.bounds.height - width;
                            h = width;
                            w = this.component.bounds.width;
                            break;
                        case "left":
                            x = 0;
                            y = 0;
                            h = this.component.bounds.height;
                            w = width;
                            break;
                    }

                    this.paintBorder(ctx, color, x, y, w, h);
                }
            }
        },
        
        paintImageBorder: function(ctx) {
            var img = th.global_resources.images[this.component.cssValue("border-image-url")];

            // check if the image is already loaded; if not, skip
            if (img.width == 0) return;

            var t, b, r, l, w, h, d;
            t = parseInt(this.component.cssValue("border-image-top"));
            b = parseInt(this.component.cssValue("border-image-bottom"));
            r = parseInt(this.component.cssValue("border-image-right"));
            l = parseInt(this.component.cssValue("border-image-left"));
            w = img.width;
            h = img.height;

            d = this.component.d();

            // we can't use d.i.t... this is border-width + padding! have to use the following values!
            bT = th.convertLengthToPixels(this.component.cssValue("border-top-width"));
            bR = th.convertLengthToPixels(this.component.cssValue("border-right-width"));
            bB = th.convertLengthToPixels(this.component.cssValue("border-bottom-width"));
            bL = th.convertLengthToPixels(this.component.cssValue("border-left-width"));

            // paint the corners
            ctx.drawImage(img, 0, 0, l, t, 0, 0, bL, bT);     // top-left
            ctx.drawImage(img, w - r, 0, r, t, d.b.w - bR, 0, bR, bT); // top-right
            ctx.drawImage(img, 0, h - b, l, b, 0, d.b.h - bB, bL, bB); // bottom-left
            ctx.drawImage(img, w - r, h - b, r, b, d.b.w - bR, d.b.h - bB, bR, bB); // bottom-right

            // paint the sides
            switch (this.component.cssValue("border-image-repeat-x")) {
                case 'stretch':
                    ctx.drawImage(img, l, 0, w - l - r, t, bL, 0, d.b.w - bL - bR, bT);
                    ctx.drawImage(img, l, h - b, w - l - r, b, bL, d.b.h - bB, d.b.w - bL - bR, bB);
                    break;
                case 'repeat':
                    var lsize;
                    ctx.save();
                    ctx.beginPath();
                    ctx.rect(bL, 0, d.b.w - bL- bR, d.b.h);
                    ctx.clip();

                    // paint the top
                    lsize = l * (bT / t);
                    for (var x = bL; x < d.b.w - bR; x += lsize) {
                        ctx.drawImage(img, l, 0, w - l - r, t, x, 0, lsize , bT);
                    }

                    lsize = r * (bB / b);
                    for (var x = bL; x < d.b.w - bR; x += lsize) {
                        ctx.drawImage(img, l, h - b, w - l - r, b, x, d.b.h - bB, lsize , bB);
                    }
                    ctx.restore();
                    break;
                default:
                    console.error('border-image-repeat-x "' + this.component.cssValue("border-image-repeat-x") + '" not supported!');
                    break;
            }

            switch (this.component.cssValue("border-image-repeat-y")) {
                case 'stretch':
                    ctx.drawImage(img, 0, t, l, h - t - b, 0, bT, bL, d.b.h - bT - bB);
                    ctx.drawImage(img, w - r, t, r, h - t - b, d.b.w - bR, bT, bR, d.b.h - bT - bB);
                    break;
                case 'repeat':
                    var lsize;
                    ctx.save();
                    ctx.beginPath();
                    ctx.rect(0, bT, d.b.w, d.b.h - bT - bB);
                    ctx.clip();

                    // paint the left
                    lsize = t * (bL / l);
                    for (var y = bT; y < d.b.h - bB; y += lsize) {
                        ctx.drawImage(img, 0, t, l, h - t - b, 0, y, bL, lsize);
                    }

                    // paint the right
                    lsize = t * (bR / r);
                    for (var y = bT; y < d.b.h - bB; y += lsize) {
                        ctx.drawImage(img, w - r, t, r, h - t - b, d.b.w - bR, y, bR, lsize);
                    }
                    ctx.restore();
                    break;
                default:
                    console.error('border-image-repeat-y "' + this.component.cssValue("border-image-repeat-x") + '" not supported!');
                    break;
            }
        },

        paintBorder: function(ctx, color, x, y, w, h) {
            ctx.fillStyle = color;
            ctx.fillRect(x, y, w, h);
        }
    }
});

th.Component = Class.define({
    type: "Component",

    uses: [
        th.ComponentHelpers
    ],

    members: {
        init: function(parms) {
            if (!parms) parms = {};
            for (var parm in parms) {
                this[parm] = parms[parm];
            }

            // support for scrolling; always set to 0
            this.scrollTop = 0;
            this.scrollLeft = 0;

            // create default values for properties that need them, otherwise undefined errors will get thrown
            if (!this.bounds) this.bounds = {};

            // create the border from the style according to the CSS box-model
            this.border = new th.SimpleBorder(this);

            // default opacity to true, otherwise repainting will be more expensive than it needs to be
            if (this.opaque == undefined) this.opaque = true;

            // hook up a reference to the global event bus; this is just sugar
            this.bus = th.global_event_bus;

            // CSS specified by stylesheets 
            this.styles = undefined;        // this is explicitly undefined so I can catch situations where we add to this directly

            // CSS specified on this component directly; add via addCss
            this.localStyles = {};

            // whether this component's css table needs to be refreshed; needs to be changed anytime the hierarchy of this component changes 
            this.refreshCss = true;
        },

        // used to obtain a throw-away canvas context for performing measurements, etc.; may or may not be the same canvas as that used to draw the component
        getScratchContext: function() {
            var scene = this.getScene();
            if (scene) return scene.scratchContext;
        },

        // insets are a traditional GUI toolkit notion that expresses the distance between the bounds of the component and
        // the component's content. traditionally, this space is either transparent or painted by a border (or painted by the
        // component itself). In Th, insets are the sum of the border width, and the padding.
        getInsets: function() {
            var insets = this.border.getInsets();

            insets = this.calculateInsets("padding-", "", insets);

            return insets;
        },

        // it's up to layout managers to support the margin; some may collapse them like CSS layout, others may treat them like
        // transparent padding outside the border like Th's default managers
        getMargins: function() {
            return this.calculateInsets("margin-");
        },

        // this is a stub intended to be extended by subclasses; exists here to prevent undefined errors
        paint: function(ctx) {},

        repaint: function() {
            // todo: at present, there are some race conditions that cause painting to be invoked before a scene is ready, so this
            // check is necessary to bail. We need to work out better rules for scenes and components, etc.
            if (!this.getScene()) return;

            this.getScene().paint(this);
        }
    }
});

// the default layout: places components in a row horizontally or vertically
th.SimpleLayout = Class.define({
    members: {
        init: function(parms) {
            if (!parms) parms = {};
            this.orientation = parms.orientation || th.HORIZONTAL;
        },

        // this code is a bit convoluted because I switched from 
        layout: function(container) {
            var d = container.d();
            if (container.children.length > 0) {
                // assign to short-cut variable to cut down on verbosity
                var h = (this.orientation == th.HORIZONTAL);

                // layoutLength is the total area that can be used for the layout (have to subtract the container's insets)
                var layoutLength = (h) ? d.b.iw : d.b.ih;

                // componentLength is the width of each component, rounded down to closest integer
                var componentLength = parseInt(layoutLength / container.children.length);

                // remainder is any fractional part left over, which will be added to each component one pixel until it runs out
                // this prevents blurriness associated with floating-point component sizes, or space left over if we just rounded
                // and dropped the fractional part entirely
                var remainder = layoutLength % container.children.length;

                var currentPosition = (h) ? d.i.l : d.i.t;  // the dimension that is variable (e.g., x axis when laying comp 
                var constantAxisPosition = currentPosition; // the dimension that is constant (e.g., y axis when laying components out horizontally)
                for (var i = 0; i < container.children.length; i++) {
                    var r = 0;
                    if (remainder > 0) {
                        remainder--;
                        r = 1;
                    }

                    var variableAxisPosition = currentPosition;
                    var length = componentLength + r;

                    container.children[i].bounds = (h) ? {
                        x:      variableAxisPosition,
                        y:      constantAxisPosition,
                        width:  length,
                        height: d.b.ih
                    } : {
                        x:      constantAxisPosition,
                        y:      variableAxisPosition,
                        width:  d.b.iw,
                        height: length
                    }

                    currentPosition += length;
                }
            }

        },

        getMinimumSize: function(container, type) {
            var dimension = (this.orientation == th.HORIZONTAL) ? "width" : "height";
            var size = 0;
            for (var i = 0; i < container.children.length; i++) {
                size += container.children[i].getMinimumSize()[dimension];
            }
            return size;
        },

        getPreferredSize: function(container) {
            var dimension = (this.orientation == th.HORIZONTAL) ? "width" : "height";
            var size = 0;
            for (var i = 0; i < container.children.length; i++) {
                size += container.children[i].getPreferredSize()[dimension];
            }
            return size;
        },

        getMaximumSize: function(container) {
            var dimension = (this.orientation == th.HORIZONTAL) ? "width" : "height";
            var size = 0;
            for (var i = 0; i < container.children.length; i++) {
                size += container.children[i].getMaximumSize()[dimension];
            }
            return size;
        }
    }
});

th.FlowLayout = Class.define({
    members: {
        init: function(orientation) {
            if (orientation != 'horizontal' && orientation != 'vertical') {
                console.error('Not known orientation "' + orientation + '"')
            }
            this.orientation = orientation == 'horizontal' ? th.HORIZONTAL : th.VERTICAL;
        },
        
         // this code is a bit convoluted because I switched from 
        layout: function(container) {
            var d = container.d();
            if (container.children.length > 0) {
                // assign to short-cut variable to cut down on verbosity
                var h = (this.orientation == th.HORIZONTAL);

                // layoutLength is the total area that can be used for the layout (have to subtract the container's insets)
                var layoutLength = (h) ? d.b.iw : d.b.ih;
                
                // 
                var side = h ? 'width' : 'height';
                var marginA = h ? 'left' : 'top';
                var marginB = h ? 'right' : 'bottom';
                var marginC = h ? 'top' : 'left';
                var marginD = h ? 'bottom' : 'right';
                
                var fixSize = 0;
                var flexFactorSum = 0;
                var childrenSizes = [];
                
                th.forEach(container.children, function(child, index) {
                    var childSize = 0;
                    var margin = child.calculateInsets('margin-', '');
                    if (child.layoutdata !== undefined) {
                        if (child.layoutdata.indexOf('px') > 0) {
                            childSize = th.convertLengthToPixels(child.layoutdata);
                        } else {
                            try {
                                flexFactorSum += parseFloat(child.layoutdata);
                                fixSize += margin[marginA] + margin[marginB];
                                return;
                            } catch(err) {
                                console.error('Cannot interpretate layoutData "' + child.layoutdata + '" of child "' + child.id + '"');
                            }
                        }
                    } else {
                        childSize += child.getPreferredSize()[side];
                    }
                    childrenSizes[index] = childSize;
                    
                    fixSize += childSize + margin[marginA] + margin[marginB];
                });
                
                var varSize = layoutLength - fixSize;
                
                var currentPosition = (h) ? d.i.l : d.i.t;  // the dimension that is variable (e.g., x axis when laying comp 
                var constantAxisPosition = (!h) ? d.i.l : d.i.t; // the dimension that is constant (e.g., y axis when laying components out horizontally)
                for (var i = 0; i < container.children.length; i++) {
                    var child = container.children[i];
                    var margin = child.calculateInsets('margin-', '');
                                        
                    var variableAxisPosition = currentPosition + margin[marginA];
                    if (childrenSizes[i] !== undefined) {
                        var length = childrenSizes[i];
                    } else {
                        var length = (varSize / flexFactorSum) * parseFloat(child.layoutdata);
                    }

                    child.bounds = (h) ? {
                        x:      variableAxisPosition,
                        y:      constantAxisPosition + margin[marginC],
                        width:  length,
                        height: d.b.iw - (margin[marginC] + margin[marginD])
                    } : {
                        x:      constantAxisPosition + margin[marginC],
                        y:      variableAxisPosition,
                        width:  d.b.iw - (margin[marginC] + margin[marginD]),
                        height: length
                    }

                    currentPosition += length + margin[marginA] + margin[marginB];
                }
            }
        }
    },

    getMinimumSize: function(container, type) {
        var dimension = (this.orientation == th.HORIZONTAL) ? "width" : "height";
        var size = 0;
        for (var i = 0; i < container.children.length; i++) {
            size += container.children[i].getMinimumSize()[dimension];
        }
        return size;
    },

    getPreferredSize: function(container) {
        var dimension = (this.orientation == th.HORIZONTAL) ? "width" : "height";
        var size = 0;
        for (var i = 0; i < container.children.length; i++) {
            size += container.children[i].getPreferredSize()[dimension];
        }
        return size;
    },

    getMaximumSize: function(container) {
        var dimension = (this.orientation == th.HORIZONTAL) ? "width" : "height";
        var size = 0;
        for (var i = 0; i < container.children.length; i++) {
            size += container.children[i].getMaximumSize()[dimension];
        }
        return size;
    }
});

th.Container = Class.define({
    type: "Container",

    superclass: th.Component,

    uses: [
        th.ContainerHelpers
    ],

    members: {
        init: function(parms) {
            this._super(parms);
            this.children = [];

            // I lazily check for a form layout specified in the "grid" property (presumably derived from the markup). I do this
            // to avoid races with stylesheet resolution, etc.
            this.checkedForFormLayout = false;

            this.layoutManager = new th.SimpleLayout();
        },

        add: function() {
            for (var z = 0; z < arguments.length; z++) {
                var component = th.isArray(arguments[z]) ? arguments[z] : [ arguments[z] ];
                this.children = this.children.concat(component);
                for (var i = 0; i < component.length; i++) {
                    component[i].parent = this;
                    component[i].refreshCss = true;
                    // // takes care of focusManager if we should do so!
                    // if (component[i].focusManaged === true && component[i].getScene().focusManager !== undefined) {
                    //     console.log('Adds ' + component[i].id + ' to focusManager of ' + component[i].getScene().id);
                    //     component[i].getScene().focusManager.subscribe(component[i]);
                    // }
                }
            }
        },

        remove: function() {
            for (var z = 0; z < arguments.length; z++) {
                var component = th.isArray(arguments[z]) ? arguments[z] : [ arguments[z] ];
                for (var i = 0; i < component.length; i++) {
                    var old_length = this.children.length;
                    this.children = th.remove(this.children, component[i]);

                    // if the length of the array has changed since I tried to remove the current component, assume it was removed and clear the parent
                    if (old_length != this.children.length) delete component[i].parent;
                }
            }
        },

        replace: function(component, index) {
            this.bus.unbind(this.children[index]);
            component.parent = this;
            this.children[index] = component;
        },

        paint: function(ctx) {
            if (this.shouldPaint()) {
                this.paintSelf(ctx);
                this.paintChildren(ctx);
            }
        },

        paintSelf: function(ctx) {},

        paintChildren: function(ctx) {
            for (var i = 0; i < this.children.length; i++ ) {
                if (!this.children[i].shouldPaint()) continue;

                if (!this.children[i].bounds) {
                    // console.log("WARNING: child " + i + " (type: " + this.children[i].declaredClass + ", id: " + this.children[i].id + ") of parent with id " + this.id + " of type " + this.declaredClass + " has no bounds and could not be painted");
                    continue;
                }

                ctx.save();
                try {
                    ctx.translate(this.children[i].bounds.x, this.children[i].bounds.y);
                } catch (error) {
                    // console.log("WARNING: child " + i + " (type: " + this.children[i].declaredClass + ", id: " + this.children[i].id + ") of parent with id " + this.id + " of type " + this.declaredClass + " has malformed bounds and could not be painted");
                    // console.log(this.children[i].bounds);
                    ctx.restore();
                    continue;
                }

                try {
//                    if (!this.children[i].style["noClip"]) {
                        ctx.beginPath();
                        ctx.rect(0, 0, this.children[i].bounds.width, this.children[i].bounds.height);
                        ctx.closePath();
                        ctx.clip();
//                    }
                } catch(ex) {
                    // console.log("Bounds problem");
                    // console.log(this.children[i].declaredClass);
                    // console.log(this.children[i].bounds);
                }

                ctx.save();
                this.children[i].paint(ctx);
                if (this.children[i].border) {
                    this.children[i].border.paint(ctx);
                }
                ctx.restore();

                ctx.restore();
            }
        },

        installLayoutManager: function(layout) {
            this.layoutManager = layout;

            // check if the components have no constraints specified; if so, we'll create them
            var constraints = false;
            for (var i = 0; i < this.children.length; i++) {
                // map the "constraints" tag attribute to the css "-th-constraints" property
                if (this.children[i]["constraints"] !== undefined) {
                    if (!this.children[i].cssValue("-th-constraints")) this.children[i].addCss("-th-constraints", this.children[i]["constraints"]);
                }

                if (this.children[i].cssValue("-th-constraints")) {
                    constraints = true;
                }
            }

            // formlayout-specific short-cut, probably ought to be in formlayout
            if (layout instanceof th.formlayout.FormLayout) {
                // if the constraints aren't specified, make them up
                if (!constraints) {
                    var row = 1;
                    var col = 1;
                    th.forEach(this.children, function(component) {
                        var found = false;
                        while (row <= layout.getRowCount()) {
                            while (col <= layout.getColumnCount()) {
                                var colspec = layout.getColumnSpec(col);
                                if (colspec.isSpacer()) {
                                    col++;
                                    continue;
                                }
                                found = true;
                                break;
                            }
                            if (found) {
                                var rowspec = layout.getRowSpec(row);
                                if (!rowspec.isSpacer()) break;
                            }
                            found = false;
                            row++;
                            col = 1;
                        }
                        if (!found) return;
                        layout.addLayoutComponent(component, new th.formlayout.CellConstraints(col, row));
                        col++;
                    });
                } else {
                    th.forEach(this.children, function(component) {
                        var constraints = component.cssValue("-th-constraints");
                        layout.addLayoutComponent(component, new th.formlayout.CellConstraints(constraints));
                    });
                }
            }
        },

        // lays out this container and any sub-containers
        layoutTree: function() {
            // if we're using the default layout, check to see if there are any specified layout alternatives in the CSS or
            // the custom layout properties
            if (!this.checkedForFormLayout) {
                this.checkedForFormLayout = true;

                // first, check the "grid" property, which can contain a string-based form layout specification
                if (this.grid) {
                    var cr = this.grid.split(";");
                    if (cr.length != 2) {
                        console.log("Couldn't parse 'grid' property: " + this.grid);
                    } else {
                        this.addCss("-th-grid-cols", cr[0]);
                        this.addCss("-th-grid-rows", cr[1]);
                    }
                    
                    var cols = this.cssValue("-th-grid-cols");
                    var rows = this.cssValue("-th-grid-rows");

                    if (cols && rows) this.installLayoutManager(new th.formlayout.FormLayout(cols, rows));
                } else if (this.flowLayout) {
                    this.layoutManager = new th.FlowLayout(this.flowLayout);
                }
            }

            this.layout();

            for (var i = 0; i < this.children.length; i++) {
                if (this.children[i].layoutTree) this.children[i].layoutTree();
            }
        },

        layout: function() {
            if (this.layoutManager) this.layoutManager.layout(this);
        },

        render: function() {
            if (!th.global_resources.loaded) return;

            this.layoutTree();
            this.repaint();
        }
    }
});

/**
 * TODOs:
 * o paint background-color
 * o CSS3 Borders
 */

th.WindowScene = Class.define({
    type: "Window",
    
    superclass: th.Scene,
    
    members: {
        init: function(parms) {
            if (!parms) parms = {};
            this._super(parms.canvasOrId, parms.baseUrlOrParams, parms.createFocusManager);

            this.isVisible = (parms.isVisible === undefined) ? false : parms.isVisible;
            this.canvas.style.position = "absolute";
            if (this.isVisible) {
                this.canvas.style.display = 'block';
            } else {
                this.canvas.style.display = 'none';
            }

            parms.x = (parms.x === undefined) ? 100 : parms.x;
            parms.y = (parms.y === undefined) ? 100 : parms.x;
            this.move(parms.x, parms.y);
            
            this.label = new th.Label();
            this.label.type = 'WindowLabel';
            this.label.text = parms.title || '';
            this.label.parent = this.root;
            this.label.addCss("visibility", "hidden");    // prevent Th from rendering the label; we'll do it ourselves

            this.isDraggable = (parms.isDraggable === undefined) ? true : parms.isDraggable;            
            if (this.isDraggable) {
                // make the window dragable :)
                th.observe(this.canvas, "mousedown", this.onmousedown, this);
                th.observe(window, "mouseup", this.onmouseup, this);
                // this event is connected to the window itself, as sometimes the mouse gets outside the WindowBar, event the 
                // mouse is still pressed. This version is working even then right.
                th.observe(window, "mousemove", this.onmousemove, this);
            }
        },
                
        move: function(x, y) {
            this.canvas.style.top = y+'px';
            this.canvas.style.left = x+'px';
            
            this.posX = x;
            this.posY = y;
            
            this.bus.fire("move", { x: x, y: y}, this);
        },
        
        centerUp: function() {
            this.move(Math.round((window.innerWidth - this.canvas.width) * 0.5), Math.round((window.innerHeight - this.canvas.height) * 0.25));
        },

        center: function() {
            this.move(Math.round((window.innerWidth - this.canvas.width) * 0.5), Math.round((window.innerHeight - this.canvas.height) * 0.5));
        },
        
        toggle: function() {
            this.isVisible = !this.isVisible;

            if (this.isVisible) {
                this.canvas.style.display = 'block';
            } else {
                this.canvas.style.display = 'none';
            }

            this.bus.fire("toggle", {isVisible: this.isVisible}, this);
        },
        
        getPosition: function() {
            return { x: this.posX, y: this.posY };
        },
        
        onmousedown: function(e) {
            var d = this.root.d();
            
            // check if the mouse was clicked on the border...
            var left = th.cumulativeOffset(this.canvas).left + d.i.l;
            var right = left + this.canvas.width - d.i.r;
            var top = th.cumulativeOffset(this.canvas).top +  d.i.t;
            var bottom = top + this.canvas.height - d.i.b;
            if (e.clientX > left && e.clientX < right && e.clientY > top && e.clientY < bottom) return; 
            
            // the mouse was clicked on the border!
            this.startValue = { mouse: { x: e.clientX, y: e.clientY }, window: this.getPosition() };
            th.stopEvent(e);
        },

        onmousemove: function(e) {
            if (this.startValue) {
                var s = this.startValue;
                var x = s.window.x - (s.mouse.x - e.clientX);
                var y = s.window.y - (s.mouse.y - e.clientY);
                this.move(x, y);

                th.stopEvent(e);
            }
        },

        onmouseup: function(e) {
            delete this.startValue;
        },
        
        paintSelf: function() {
            if (this.label.text == '') return;
            
            var ctx = this.canvas.getContext("2d")
            
            this.label.resolveCss();
            this.label.bounds = {   x: th.convertLengthToPixels(this.label.cssValue('left') || '0px'),
                                    y: th.convertLengthToPixels(this.label.cssValue('top') || '0px'),
                                    width:  th.convertLengthToPixels(this.label.cssValue('width')) || this.label.getPreferredSize().width,
                                    height:  th.convertLengthToPixels(this.label.cssValue('width')) || this.label.getPreferredSize().height
                                };
            ctx.save();
            ctx.translate(this.label.bounds.x, this.label.bounds.y);
            this.label.paint(ctx);
            ctx.restore();
        }
    }
});
