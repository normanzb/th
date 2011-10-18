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

//= require "util"

if (typeof th == "undefined") th = {};

th.EventHelpers = new Trait({
    methods: {
        // only works on a Scene at the moment as it uses  
        wrapEvent: function(e, root) {
            // compute the canvas-local coordinates
            var x = e.pageX - th.cumulativeOffset(this.canvas).left;
            var y = e.pageY - th.cumulativeOffset(this.canvas).top;

            var component = root.getComponentForPosition(x, y, true);
            e.thComponent = component;

            this.addComponentXY(e, root, component);
        },

        // changes clientX and clientY from space of source to space of dest; no change wraught if dest incompatible with source
        addComponentXY: function(e, source, dest) {
            if (!dest.bounds) {
                console.log("No dest bounds - " + dest.type);
                console.log(dest.bounds);
                console.log(dest);
                return;
            }

            // compute the canvas-local coordinates
            var x = e.pageX - th.cumulativeOffset(this.canvas).left;
            var y = e.pageY - th.cumulativeOffset(this.canvas).top;
            
            var nxy = { x: x, y: y };

            var c = dest;
            while (c) {
                nxy.x -= c.bounds.x;
                nxy.y -= c.bounds.y;
                c = c.parent;

                if (c == source) {
                    e.componentX = nxy.x;
                    e.componentY = nxy.y;
                    return;
                }
            }
        }
    }
});

th.StringHelpers = new Trait({
    methods: {
        isPercentage: function(value) {
            return value.indexOf && value.indexOf("%") != -1;    // TODO: make more robust
        }
    }
});

th.ComponentHelpers = new Trait({
    methods: {
        // returns hash with some handy short-cuts for painting
        d: function() {
            var insets = this.getInsets(); // better to calculate the insets once
            return {
               b: (this.bounds) ? { x: this.bounds.x, y: this.bounds.y, w: this.bounds.width, h: this.bounds.height,
                                    iw: this.bounds.width - insets.left - insets.right,
                                    ih: this.bounds.height - insets.top - insets.bottom } : {},
               i: { l: insets.left, r: insets.right, t: insets.top, b: insets.bottom,
                    w: insets.left + insets.right, h: insets.top + insets.bottom }
            }
        },

        isVertical: function() {
            return (this.orientation == th.VERTICAL);  
        },

        isHorizontal: function() {
            return (this.orientation == th.HORIZONTAL);
        },

        shouldPaint: function() {
            return (this.shouldLayout() && this.cssValue("visibility") != "hidden");
        },

        shouldLayout: function() {
            return (this.cssValue("display") != "none");
        },

        emptyInsets: function() {
            return { left: 0, right: 0, bottom: 0, top: 0 };
        },

        resolveCss: function() {
            // right now, all components tie into the global resources bucket; this is fine for now but may need to be loaded from the scene
            var resources = th.global_resources;

            // contains the new set of declarations for the component
            var declarations;

            // check the cache for
            var cacheKey = th.getHierarchyString(this);
            if (resources.resolvedCssCache[cacheKey]) {
                declarations = resources.resolvedCssCache[cacheKey];
            } else {
                declarations = {};

                // process the user agent styles first
                var propertyName;
                var sheetTypes = [ "userAgentCss", "userCss", "authorCss" ];
                for (var i = 0; i < sheetTypes.length; i++) {
                    // css splits sheets into user agent, user, and author categories, each of which has different priority
                    // we'll implement this by having the same code take three passes, dynamically grabbing the appropriate CSS array
                    // from the Resources.
                    //
                    // this will have to change if we support !important as the user gets a final crack at overridding author sheets
                    var currentSheet = sheetTypes[i];
                    th.forEach(resources[currentSheet], function(css) {
                        for (var selector in css) {
                            // a selector may be compound (e.g., foo, bar, car {}) so we split it out by comma to treat each piece of
                            // the selector independently
                            var selectorPieces = selector.split(",");
                            for (var s = 0; s < selectorPieces.length; s++) {
                                var selectorPiece = th.trim(selectorPieces[s]);
                                var specificity = this.getSpecificity(selectorPiece);

                                // separate out the pseudo-* stuff
                                var pseudos = selectorPiece.split(":");
                                var selectorBit = pseudos[0];
                                pseudos = (pseudos.length > 1) ? pseudos.slice(1) : [ "(default)" ];

                                // if this selector selects this component, let's add the rules to the declarations bucket
                                if (this.matchesSelector(selectorBit)) {
                                    var properties = css[selector];

                                    for (propertyName in properties) {
                                        for (var i = 0; i < pseudos.length; i++) {
                                            var pseudoBit = pseudos[i];
                                            if (declarations[pseudoBit] === undefined) declarations[pseudoBit] = {};

                                            var prop = {
                                                value: properties[propertyName],
                                                selector: selectorPiece,
                                                specificity: specificity
                                            };

                                            // check which of the properties "wins"
                                            if (declarations[pseudoBit][propertyName]) {
                                                prop = this.getSpecificityWinner(prop, declarations[pseudoBit][propertyName]);
                                            }

                                            declarations[pseudoBit][propertyName] = prop;
                                        }
                                    }
                                }
                            }
                        }
                    }, this);
                }

                resources.resolvedCssCache[cacheKey] = declarations;
                this.blowCssCaches();
            }

            this.styles = {};
            for (var pseudoBit in declarations) {
                for (var declaration in declarations[pseudoBit]) {
                    if (this.styles[pseudoBit] === undefined) this.styles[pseudoBit] = {};

                    this.styles[pseudoBit][declaration] = declarations[pseudoBit][declaration].value;
                }
            }

            this.refreshCss = false;
        },

        // only id and class selectors are supported at the moment. it is assumed the passed in value has already been trimmed.
        matchesSelector: function(selector) {
            var s = selector.toLowerCase();

            // universal selector
            if (s == "*") return true;

            // simple child selector support, must be "SEL1 > SEL2"
            if (s.indexOf(">") != -1) {
                var ss = s.split(">");

                if (ss.length != 2) {
                    console.log("unsupported child selector syntax; must be SEL1 > SEL2, was '" + selector + "'");
                    return false;
                }

                if (this.matchesSelector(th.trim(ss[1]))) {
                    if (!this.parent) return false;
                    return (this.parent.matchesSelector(th.trim(ss[0])));
                }

                return false;
            }

            // simple ancestor selector support, must be "SEL1 SEL2"
            if (s.indexOf(" ") != -1) {
                var ss = s.split(" ");

                if (ss.length != 2) {
                    console.log("unsupported ancestor selector syntax; must be SEL1 SEL2, was '" + selector + "'");
                    return false;
                }

                if (this.matchesSelector(th.trim(ss[1]))) {
                    var ancestor = this.parent;
                    while (ancestor) {
                        if (ancestor.matchesSelector(th.trim(ss[0]))) return true;
                        ancestor = ancestor.parent;
                    }

                    return false;
                }
            }
            
            // class selector
            if (s.indexOf(".") == 0) {
                if (!this.className) return false;
                if (this.className.toLowerCase() == s.substring(1)) return true;
            }

            // id selector
            if (s.indexOf("#") == 0) {
                if (!this.id) return false;
                return ("#" + this.id).toLowerCase() == s;
            }

            // type selector
            var type = this.type.toLowerCase();
            if (type == s) return true;

            // type selector / id hybrid
            if (this.id && (s == (type + "#" + this.id))) return true;

            // type selector / class hybrid
            if (this.className && (s == (type + "." + this.className.toLowerCase()))) return true;

            return false;
        },

        getSpecificity: function(selector, isLocal) {
            var s = { a: 0, b: 0, c: 0, d: 0 };

            if (isLocal) s.a = 1;   // "style" attribute

            var pieces = th.getSpaceDelimitedItems(selector);
            for (var i = 0; i < pieces.length; i++) {
                var p = pieces[i];
                if (p == "*" || p == "+" || p == ">") continue;

                if (p.indexOf("#") == 0) {
                    s.b += 1;
                    continue;
                }

                s.c += p.split(".").length - 1; // number of attributes in the selector

                var pseudo = p.split(":");
                if (pseudo.length == 2) {
                    if (pseudo[1] == "first-line" || pseudo[1] == "first-letter" || pseudo[1] == "before" || pseudo[1] == "after") {
                        s.d += 1;
                    } else {
                        s.c += 1;
                    }
                }
            }

            return s;
        },

        // checks which of the two rules is the winner, passing back the first parameter if there's no winner
        getSpecificityWinner: function(contender1, contender2) {
            var c1 = contender1.specificity;
            var c2 = contender2.specificity;

            if (c1.a > c2.a) return contender1;
            if (c2.a > c1.a) return contender2;

            if (c1.b > c2.b) return contender1;
            if (c2.b > c1.b) return contender2;

            if (c1.c > c2.c) return contender1;
            if (c2.c > c1.c) return contender2;

            if (c1.d > c2.d) return contender1;
            if (c2.d > c1.d) return contender2;

            return contender1;
        },

        // paints the background of the component using the optionally passed coordinates using CSS properties; if no coordinates are
        // passed, will default to painting the background on the entire component, which is generally the default and expected behavior
        paintBackground: function(ctx, x, y, w, h) {
            var d = this.d();
            // you can't set x = d.i.l, as this is the sum of border-left-width + padding-left!
            if (x === undefined) x = th.convertBorderLengthToPixels(this.cssValue('border-left-width') || '0px');
            if (y === undefined) y = th.convertBorderLengthToPixels(this.cssValue('border-top-width') || '0px');
            if (w === undefined) w = d.b.w - x - th.convertBorderLengthToPixels(this.cssValue('border-right-width') || '0px');
            if (h === undefined) h = d.b.h - y - th.convertBorderLengthToPixels(this.cssValue('border-bottom-width') || '0px');

            // Firefox doesn't like to have paint condinates beeing NaN!
            // if the component isn't setup yet corretly this can be happen...
            if (isNaN(x) || isNaN(y) || isNaN(w) || isNaN(h)) {
                return;
            }

            if (this.cssValue("background-color")) {
                ctx.fillStyle = this.cssValue("background-color");
                
                ctx.fillRect(x, y, w, h);
            }

            if (this.cssValue("background-image")) {
                var img = this.cssValue("background-image");
                var repeat = this.cssValue("background-repeat");
                var position = this.cssValue("background-position");

                var imgs = th.getCommaDelimitedItems(img);
                var repeats = (repeat) ? repeat.split(",") : [ undefined ];
                var positions = (position) ? position.split(",") : [ undefined ];

                var iterations = Math.max(imgs.length, repeats.length, positions.length);
                for (var i = 0; i < iterations; i++) {
                    var ci = i;
                    if (i >= imgs.length) ci = (imgs.length % i) - 1;
                    var cimg = this.processImage(th.trim(imgs[ci]), w, h);

                    if (cimg) {
                        var ri = i;
                        if (i >= repeats.length) ri = (repeats.length % i) - 1;

                        var pi = i;
                        if (i >= positions.length) pi = (positions.length % i) - 1;
                        
                        this.paintImage(ctx, cimg, th.trim(repeats[ri]), th.trim(positions[pi]), x, y, w, h);
                    }
                }
            }
        },

        getFirstBackgroundImage: function() {
            var img = this.cssValue("background-image");
            if (img) {
                var imgs = th.getCommaDelimitedItems(img);
                if (imgs[0]) {
                    img = th.global_resources.images[imgs[0]];
                    if (img) return img;
                }
            }
        },

        processImage: function(img, w, h) {
            // check if the img is actually a string specifying a gradient
            if (img.indexOf("-webkit-gradient") == 0) {
                // parse the gradient specification

                // kill the first left paren and last character, which should be a right paren
                var parmstring = img.substring(img.indexOf("(") + 1, img.length - 1);

                // split based on commas that occur outside of parenthesis
                var parms = th.getCommaDelimitedItems(parmstring);
                for (var i = 0; i < parms.length; i++) parms[i] = th.trim(parms[i]);

                // only linear gradients supported at present
                if (parms[0] != "linear") {
                    console.log("Unsupported gradient: \"" + img + "\"; only linear gradients supported");
                    return undefined;
                }

                // get the start and stop positions of the gradient; these are either numbers, percentages, or keywords
                var pxy0 = parms[1].split(" ");
                var pxy1 = parms[2].split(" ");

                // create new variables for positions because I may need to flip those above
                var xy0 = [];
                var xy1 = [];

                // flip the keywords if the order is wrong (e.g., top left => left top)
                xy0[0] = (pxy0[0] == "top" || pxy0[0] == "bottom") ? pxy0[1] : pxy0[0];
                xy0[1] = (pxy0[0] == "top" || pxy0[0] == "bottom") ? pxy0[0] : pxy0[1];
                xy1[0] = (pxy1[0] == "top" || pxy1[0] == "bottom") ? pxy1[1] : pxy1[0];
                xy1[1] = (pxy1[0] == "top" || pxy1[0] == "bottom") ? pxy1[0] : pxy1[1];

                // check each point to see if its a keyword or a percentage and convert to a number
                var bothpoints = [ xy0, xy1 ];
                for (var a = 0; a < bothpoints.length; a++) {
                    var pa = bothpoints[a];
                    for (var b = 0; b < pa.length; b++) {
                        if (pa[b] == "top") pa[b] = "0%";
                        if (pa[b] == "bottom") pa[b] = "100%";
                        if (pa[b] == "left") pa[b] = "0%";
                        if (pa[b] == "right") pa[b] = "100%";

                        if (th.isPercentage(pa[b])) {
                            var multiplier = parseInt(pa[b]) / 100;
                            pa[b] = multiplier * ( (b == 0) ? w : h );
                        }
                    }
                }

                // we now know the start and end points of the gradient; now time to create the canvas to draw the gradient
                var canvas = document.createElement("canvas");
                canvas.setAttribute("width", w);
                canvas.setAttribute("height", h);
                var ctx = canvas.getContext("2d");

                // create a gradient with the start and end point
                var gradient = ctx.createLinearGradient(xy0[0], xy0[1], xy1[0], xy1[1]);

                // get the stops and add them
                for (var c = 3; c < parms.length; c++) {
                    var vals = parms[c].split("(");

                    // if there's a comma, the stop position has been specified
                    if (vals[1].indexOf(",") != -1) {
                        var posColor = vals[1].split(",");
                        posColor[1] = th.trim(posColor[1].substring(0, posColor[1].length - 1));
                        gradient.addColorStop(posColor[0], posColor[1]);
                    } else {
                        // otherwise, this is a "from" or "to" entry
                        vals[1] = vals[1].substring(0, vals[1].length - 1); // kill the trailing right paren; this is now a color value

                        // add the gradient stop; from == 0, to == 1.0.
                        gradient.addColorStop((vals[0].toLowerCase() == "from" ? 0 : 1.0), vals[1]);
                    }
                }

                ctx.fillStyle = gradient;
                ctx.fillRect(0, 0, w, h);
                return canvas;
            } else {
                if (!th.global_resources.images[img]) {
                    console.log("Warning: image identified by '" + img + "'");
                } else {
                    return th.global_resources.images[img];
                }
            }
        },

        // paints the image on the ctx using the optional repeat, position, x, y, w, h values, any of which may be undefined
        paintImage: function(ctx, img, repeat, position, x, y, w, h) {
            if (!repeat) repeat = "repeat";
            if (!position) position = "0% 0%";

            if (!x) x = 0;
            if (!y) y = 0;
            if (!w) w = this.bounds.width;
            if (!h) h = this.bounds.height;

            ctx.save();
            try {
                if ((x != 0) || (y != 0)) ctx.translate(x, y);
                ctx.beginPath();
                ctx.rect(0, 0, w, h);
                ctx.clip();

                // convert the position string into two different numbers
                var pos = position.toLowerCase().split(" ");
                if (pos.length == 1) pos.push("50%");
                if (pos.length != 2) {
                    console.log("Unsupported position syntax; only \"X\" or \"X Y\" supported, you passed in \" + position + \"");
                    return;
                }

                // order is x, y *unless* one they are keywords, in which case they *might* be reversed
                var xy = [];
                xy[0] = (pos[0] == "top" || pos[0] == "bottom") ? pos[1] : pos[0];
                xy[1] = (pos[0] == "top" || pos[0] == "bottom") ? pos[0] : pos[1];

                // convert positions to percentages if they are keywords
                th.forEach(xy, function(p, index) {
                    if (p == "top") xy[index] = "0%";
                    if (p == "right") xy[index] = "100%";
                    if (p == "bottom") xy[index] = "100%";
                    if (p == "left") xy[index] = "0%";
                    if (p == "center") xy[index] = "50%";
                });

                // convert positions to pixels; if the positions are lengths, the image's origin is drawn at the specified position.
                // if the positions are percentages, the percentage represents both the position at which the image is to be drawn
                // and the amount the origin should be translated before image is drawn (a touch confusing)
                var txy = [0, 0];
                for (var i = 0; i < xy.length; i++) {
                    var percentage = th.isPercentage(xy[i]);
                    var pixelPosition = this.convertPositionToPixel(xy[i], (i == 0) ? w : h);
                    if (percentage) txy[i] = this.convertPositionToPixel(xy[i], (i == 0) ? img.width : img.height);
                    xy[i] = pixelPosition;
                }

                // the position where we should draw the image
                var sx = xy[0] - txy[0];
                var sy = xy[1] - txy[1];

                // now we can draw the frickin' picture
                if (!this.shouldRepeat(repeat)) {
                    ctx.drawImage(img, xy[0] - txy[0], xy[1] - txy[1]);
                } else {
                    var xloopEnd = (this.shouldRepeatX(repeat)) ? parseInt(w / img.width) + 1 : 1;
                    var yloopEnd = (this.shouldRepeatY(repeat)) ? parseInt(h / img.height) + 1 : 1;
                    if (this.shouldRepeatX(repeat)) while (sx > 0) sx -= img.width;
                    if (this.shouldRepeatY(repeat)) while (sy > 0) sy -= img.height;
                    var sxstart = sx;
                    for (var yloop = 0; yloop < yloopEnd; yloop++) {
                        sx = sxstart;
                        for (var xloop = 0; xloop < xloopEnd; xloop++) {
                            ctx.drawImage(img, sx, sy);
                            sx += img.width;
                        }
                        sy += img.height;
                    }
                }
            } finally {
                ctx.restore();
            }
        },

        shouldRepeatX: function(repeat) {
            return (repeat == "repeat" || repeat == "repeat-x");
        },

        shouldRepeatY: function(repeat) {
            return (repeat == "repeat" || repeat == "repeat-y");  
        },

        shouldRepeat: function(repeat) {
            return (repeat != "no-repeat");
        },

        convertPositionToPixel: function(pos, totalLength) {
            if (th.isPercentage(pos)) {
                var per = pos.substring(0, pos.length - 1) / 100;
                return totalLength * per;
            } else if (th.isCssPixel(pos)) {
                return pos.substring(0, pos.length - 2);
            }
        },

        calculateInsets: function(cssPrefix, cssSuffix, oldInsets) {
            // "this" is either a border or a component; if a border, we need to get the reference to the component
            var component = (this.component) ? this.component : this;

            var cacheKey = cssPrefix + cssSuffix;

            // create the inset cache if not existing
            if (component["insetCache"]) {
                //if (component.insetCache[cacheKey]) return component.insetCache[cacheKey];
            }

            var insets = { top: 0, bottom: 0, left: 0, right: 0 };
            if (oldInsets) {
                insets.top += oldInsets.top;
                insets.left += oldInsets.left;
                insets.right += oldInsets.right;
                insets.bottom += oldInsets.bottom;
            }

            for (var side in insets) {
                var value = th.safeget(component.cssValue(cssPrefix + side + cssSuffix), 0);
                if (value) value = th.convertLengthToPixels(value, component);
                insets[side] += value;
            }

            if (!component["insetCache"]) component.insetCache = {};
            component.insetCache[cacheKey] = insets;

            return insets;
        },

        getCurrentPseudoClass: function() {
            if (this.pseudoClass) return this.pseudoClass;
            return "(default)";
        },

        // resolves the value for a CSS property, dealing with inheritance
        cssValue: function(property, pseudoBit) {
            if (pseudoBit === undefined) pseudoBit = this.getCurrentPseudoClass();

            if (this.localStyles[pseudoBit] === undefined) this.localStyles[pseudoBit] = {};
            if (this.localStyles[pseudoBit][property] !== undefined) return this.localStyles[pseudoBit][property];

            if (typeof this.styles == "undefined" || this.refreshCss) this.resolveCss();

            if (this.styles[pseudoBit] === undefined) this.styles[pseudoBit] = {};

            var propertyValue = this.styles[pseudoBit][property];

            // if the property is defined, return it--as long as the value isn't inherited
            if (propertyValue && propertyValue != "inherit") return this.styles[pseudoBit][property];

            // if the property is inherited, return the parent value
            if (propertyValue == "inherit" && this.parent) return this.parent.cssValue(property);

            // if we didn't have a match for the pseudo-class, re-try default before inheriting
            if (pseudoBit != "(default)") return this.cssValue(property, "(default)");

            // border-xxx-color property default to color; re-route if these properties aren't present
            if (property == "border-top-color" || property == "border-left-color" || property == "border-right-color" || property == "border-bottom-color") {
                return this.cssValue("color");
            }

            // short-cut properties are removed from styles[] and expanded out; they are created dynamically if requested
            if (property == "border" || property == "border-top" || property == "border-left" || property == "border-right" || property == "border-bottom") {
                // I'm a lazy git
                throw "Unsupported: request the individual border properties, please";
            }

            if (property == "margin") {
                // I'm a lazy git
                throw "Unsupported: request the individual margin-top, margin-bottom, margin-right, and margin-left properties, please";
            }

            if (property == "padding") {
                // I'm a lazy git
                throw "Unsupported: request the individual padding-top, padding-bottom, padding-right, and padding-left properties, please";
            }

            // properties that inherit. Note: only the "font" short-cut property is supported, not its expanded forms. This is because
            // (1) canvas expects the short-cut form in its "font" property, and (2) parsing the "font" CSS property is trickier
            // than the other short-cut properties (especially with its not-quite-a-real-property for system fonts)
            if ([ "color", "letter-spacing", "line-height", "text-align", "text-indent", "text-transform",
                    "visibility", "white-space", "word-spacing", "font" ].indexOf(property) != -1) {
                if (this.parent) return this.parent.cssValue(property);
            }
            if (property.indexOf("list-style-") != -1) if (this.parent) return this.parent.cssValue(property);

            // default behavior; return undefined
            return;
        },

        addCss: function(propertyOrHashOfProperties, value, pseudoBit) {
            if (th.isString(propertyOrHashOfProperties)) {
                var prop = propertyOrHashOfProperties;

                this.blowCssCaches(prop);

                if (pseudoBit === undefined) pseudoBit = "(default)";
                if (this.localStyles[pseudoBit] === undefined) this.localStyles[pseudoBit] = {};

                th.expandCssProperty(prop, value, this.localStyles[pseudoBit]);
            } else {
                for (var property in propertyOrHashOfProperties) {
                    this.addCss(property, propertyOrHashOfProperties[property], pseudoBit);
                }
            }
        },

        // added for FormLayout
        getSize: function() {
            var bounds = this.bounds;
            return { width: bounds.width, height: bounds.height };
        },

        // added for FormLayout
        setBounds: function(x, y, w, h) {
            this.bounds = { x: x, y: y, width: w, height: h };
        },

        getPreferredSize: function() {
            // if specific per-dimension preferred size functions are present, use them
            if (this.getPreferredHeight && this.getPreferredWidth) {
                var height = this.getPreferredHeight();
                var width = this.getPreferredWidth();
                return { height: height, width: width };
            }

            var insets = this.getInsets();

            // otherwise, punt
            return { height: insets.top + insets.bottom, width: insets.left + insets.right };
        },

        getMinimumSize: function() {
            // if specific per-dimension preferred size functions are present, use them
            if (this.getMinimumHeight && this.getMinimumWidth) {
                var height = this.getMinimumHeight();
                var width = this.getMinimumWidth();
                return { height: height, width: width };
            }

            // otherwise, map to preferred size
            return this.getPreferredSize();
        },

        getMaximumSize: function() {
            // if specific per-dimension preferred size functions are present, use them
            if (this.getMaximumHeight && this.getMaximumWidth) {
                var height = this.getMaximumHeight();
                var width = this.getMaximumWidth();
                return { height: height, width: width };
            }

            // otherwise, map to preferred size
            return this.getPreferredSize();
        },

        getScene: function() {
            if (this.scene) return this.scene;

            if (!this.parent) return;

            var container = this.parent;
            while (!container.scene && container.parent) container = container.parent;
            return container.scene;
        },

        blowCssCaches: function(prop) {
            if (this.component) console.log("WARNING: BLOW CACHE has a component reference");

            if (prop === undefined) {
                // if no prop passed in, blow away everything
                delete this.insetCache;
                return;
            }

            // if there is a property, be smart about what we blow away
            if (prop.indexOf("border") != -1 || prop.indexOf("margin") != -1 || prop.indexOf("padding") != -1) {
                delete this.insetCache;
            }
        },

        isInsideOf: function(ancestor) {
            var parent = this.parent;
            while (parent) {
                if (parent === ancestor) return true;
                parent = parent.parent;
            }
            return false;
        }
    }
});

th.ContainerHelpers = new Trait({
    methods: {
        getComponentForPosition: function(x, y, recurse) {  
            for (var i = 0; i < this.children.length; i++) {
                if (!this.children[i].bounds) continue;
                
                if (this.children[i].bounds.x <= x && this.children[i].bounds.y <= y
                        && (this.children[i].bounds.x + this.children[i].bounds.width) >= x
                        && (this.children[i].bounds.y + this.children[i].bounds.height) >= y) {
                    if (!recurse) return this.children[i];

                    if (!this.children[i].shouldPaint()) continue;

                    return (this.children[i].getComponentForPosition) ?
                           this.children[i].getComponentForPosition(x - this.children[i].bounds.x, y - this.children[i].bounds.y, recurse) :
                           this.children[i];
                }
            }

            return this;
        },

        removeAll: function() {
            this.remove(this.children);
        },

        getMinimumSize: function() {
            return (this.layoutManager) ? this.layoutManager.getMinimumSize(this) : this._super();
        },

        getPreferredSize: function() {
            return (this.layoutManager) ? this.layoutManager.getPreferredSize(this) : this._super();
        },

        getMaximumSize: function() {
            return (this.layoutManager) ? this.layoutManager.getMaximumSize(this) : this._super();
        }
    }
});

th.BorderHelpers = new Trait({
    methods: {
        // rectangle/box object utils:
        //  rectangle = [x, y, w, h]
        inset: function (r, d) {
            if (typeof d == "number") {
                // inset(box, delta)
                r.x += d;
                r.y += d;
                r.w -= 2*d;
                r.h -= 2*d;
            } else if (th.isArray(d) && d.length == 4) {
                // inset(box, [top, right, bottom, left])
                r.x += d[0];
                r.y += d[1];
                r.w -= d[1] + d[3];
                r.h -= d[0] + d[2];
            }
        },
        
        cornerX: function (r, c) {
            switch (c) {
                case 0:
                case 3:
                    return r.x;
                case 1:
                case 2:
                    return r.x + r.w;
            }
        },

        cornerY: function (r, c) {
            switch (c) {
                case 0:
                case 1:
                    return r.y;
                case 2:
                case 3:
                    return r.y + r.h;
            }
        },

        round: function (r) {
            r.x = Math.round(r.x);
            r.y = Math.round(r.y);
            r.w = Math.round(r.w);
            r.h = Math.round(r.h);
        },

        emptyRect: function (r) {
            return (r.w <= 0) || (r.h <= 0);
        },

        // side2D methods
        // side2D = [w, h]
        isZeroSize: function (s) {
            return (s.w <= 0) && (s.h <= 0);
        },

        // misc. methods

        next: function (s) {
            var i = (s + 1) % 4;
            if (i < 0) return i + 4;
            return i;
        },

        prev: function (s) {
            var i = (s - 1) % 4;
            if (i < 0) return i + 4;
            return i;
        },

        allCornersZeroSize: function (arr) {
            var isZero = this.isZeroSize;
            return isZero(arr[0]) && isZero(arr[1]) && isZero(arr[2]) && isZero(arr[3]);
        },

        checkFourFloatsEqual: function (arr, f) { // this works for more than just floats :)
            return (arr[0] == f && arr[1] == f && arr[2] == f && arr[3] == f);
        },

        computeInnerRadii: function (aRadii, borderSizes) {
            var radii = [];
            var rtl = aRadii[this.TOP_LEFT];
            var rtr = aRadii[this.TOP_RIGHT];
            var rbr = aRadii[this.BOTTOM_RIGHT];
            var rbl = aRadii[this.BOTTOM_LEFT];

            var t = borderSizes[0];
            var r = borderSizes[1];
            var b = borderSizes[2];
            var l = borderSizes[3];
            radii[this.TOP_LEFT] = {
                w: Math.max(0, rtl.w - l),
                h: Math.max(0, rtl.h - t)
            };
            radii[this.TOP_RIGHT] = {
                w: Math.max(0, rtr.w - r),
                h: Math.max(0, rtr.h - t)
            };
            radii[this.BOTTOM_RIGHT] = {
                w: Math.max(0, rbr.w - r),
                h: Math.max(0, rbr.h - b)
            };
            radii[this.BOTTOM_LEFT] = {
                w: Math.max(0, rbl.w - l),
                h: Math.max(0, rbl.h - b)
            }
            return radii;
        },

        traceRoundRect: function (ctx, rect, radii, clockwise) {
            if (clockwise) {
                ctx.moveTo(rect.x, rect.y + radii[this.TOP_LEFT].h);
                ctx.quadraticCurveTo(rect.x, rect.y, rect.x + radii[this.TOP_LEFT].w, rect.y);
                ctx.lineTo(rect.x + rect.w - radii[this.TOP_RIGHT].w, rect.y);
                ctx.quadraticCurveTo(rect.x + rect.w, rect.y, rect.x + rect.w, rect.y + radii[this.TOP_RIGHT].h);
                ctx.lineTo(rect.x + rect.w, rect.y + rect.h - radii[this.BOTTOM_RIGHT].h);
                ctx.quadraticCurveTo(rect.x + rect.w, rect.y + rect.h, rect.x + rect.w - radii[this.BOTTOM_RIGHT].w, rect.y + rect.h);
                ctx.lineTo(rect.x + radii[this.BOTTOM_LEFT].w, rect.y + rect.h);
                ctx.quadraticCurveTo(rect.x, rect.y + rect.h, rect.x, rect.y + rect.h - radii[this.BOTTOM_LEFT].h);
                ctx.lineTo(rect.x, rect.y + radii[this.TOP_LEFT].h);
            } else {
                ctx.moveTo(rect.x, rect.y + radii[this.TOP_LEFT].h);
                ctx.lineTo(rect.x, rect.y + rect.h - radii[this.BOTTOM_LEFT].h)
                ctx.quadraticCurveTo(rect.x, rect.y + rect.h, rect.x + radii[this.BOTTOM_LEFT].w, rect.y + rect.h);
                ctx.lineTo(rect.x + rect.w - radii[this.BOTTOM_RIGHT].w, rect.y + rect.h);
                ctx.quadraticCurveTo(rect.x + rect.w, rect.y + rect.h, rect.x + rect.w, rect.y + rect.h - radii[this.BOTTOM_RIGHT].h);
                ctx.lineTo(rect.x + rect.w, rect.y + radii[this.TOP_RIGHT].h);
                ctx.quadraticCurveTo(rect.x + rect.w, rect.y, rect.x + rect.w - radii[this.TOP_RIGHT].w, rect.y);
                ctx.lineTo(rect.x + radii[this.TOP_LEFT].w, rect.y);
                ctx.quadraticCurveTo(rect.x, rect.y, rect.x, rect.y + radii[this.TOP_LEFT].h);
            }
        }
    }
});

th.ColorHelpers = new Trait({
    methods: {
        colors: {
            aliceblue: [0xf0, 0xf8, 0xff],
            antiquewhite: [0xfa, 0xeb, 0xd7],
            aqua: [0x00, 0xff, 0xff],
            aquamarine: [0x7f, 0xff, 0xd4],
            azure: [0xf0, 0xff, 0xff],
            beige: [0xf5, 0xf5, 0xdc],
            bisque: [0xff, 0xe4, 0xc4],
            black: [0x00, 0x00, 0x00],
            blanchedalmond: [0xff, 0xeb, 0xcd],
            blue: [0x00, 0x00, 0xff],
            blueviolet: [0x8a, 0x2b, 0xe2],
            brown: [0xa5, 0x2a, 0x2a],
            burlywood: [0xde, 0xb8, 0x87],
            cadetblue: [0x5f, 0x9e, 0xa0],
            chartreuse: [0x7f, 0xff, 0x00],
            chocolate: [0xd2, 0x69, 0x1e],
            coral: [0xff, 0x7f, 0x50],
            cornflowerblue: [0x64, 0x95, 0xed],
            cornsilk: [0xff, 0xf8, 0xdc],
            crimson: [0xdc, 0x14, 0x3c],
            cyan: [0x00, 0xff, 0xff],
            darkblue: [0x00, 0x00, 0x8b],
            darkcyan: [0x00, 0x8b, 0x8b],
            darkgoldenrod: [0xb8, 0x86, 0x0b],
            darkgray: [0xa9, 0xa9, 0xa9],
            darkgreen: [0x00, 0x64, 0x00],
            darkgrey: [0xa9, 0xa9, 0xa9],
            darkkhaki: [0xbd, 0xb7, 0x6b],
            darkmagenta: [0x8b, 0x00, 0x8b],
            darkolivegreen: [0x55, 0x6b, 0x2f],
            darkorange: [0xff, 0x8c, 0x00],
            darkorchid: [0x99, 0x32, 0xcc],
            darkred: [0x8b, 0x00, 0x00],
            darksalmon: [0xe9, 0x96, 0x7a],
            darkseagreen: [0x8f, 0xbc, 0x8f],
            darkslateblue: [0x48, 0x3d, 0x8b],
            darkslategray: [0x2f, 0x4f, 0x4f],
            darkslategrey: [0x2f, 0x4f, 0x4f],
            darkturquoise: [0x00, 0xce, 0xd1],
            darkviolet: [0x94, 0x00, 0xd3],
            deeppink: [0xff, 0x14, 0x93],
            deepskyblue: [0x00, 0xbf, 0xff],
            dimgray: [0x69, 0x69, 0x69],
            dimgrey: [0x69, 0x69, 0x69],
            dodgerblue: [0x1e, 0x90, 0xff],
            firebrick: [0xb2, 0x22, 0x22],
            floralwhite: [0xff, 0xfa, 0xf0],
            forestgreen: [0x22, 0x8b, 0x22],
            fuchsia: [0xff, 0x00, 0xff],
            gainsboro: [0xdc, 0xdc, 0xdc],
            ghostwhite: [0xf8, 0xf8, 0xff],
            gold: [0xff, 0xd7, 0x00],
            goldenrod: [0xda, 0xa5, 0x20],
            gray: [0x80, 0x80, 0x80],
            green: [0x00, 0x80, 0x00],
            greenyellow: [0xad, 0xff, 0x2f],
            grey: [0x80, 0x80, 0x80],
            honeydew: [0xf0, 0xff, 0xf0],
            hotpink: [0xff, 0x69, 0xb4],
            indianred: [0xcd, 0x5c, 0x5c],
            indigo: [0x4b, 0x00, 0x82],
            ivory: [0xff, 0xff, 0xf0],
            khaki: [0xf0, 0xe6, 0x8c],
            lavender: [0xe6, 0xe6, 0xfa],
            lavenderblush: [0xff, 0xf0, 0xf5],
            lawngreen: [0x7c, 0xfc, 0x00],
            lemonchiffon: [0xff, 0xfa, 0xcd],
            lightblue: [0xad, 0xd8, 0xe6],
            lightcoral: [0xf0, 0x80, 0x80],
            lightcyan: [0xe0, 0xff, 0xff],
            lightgoldenrodyellow: [0xfa, 0xfa, 0xd2],
            lightgray: [0xd3, 0xd3, 0xd3],
            lightgreen: [0x90, 0xee, 0x90],
            lightgrey: [0xd3, 0xd3, 0xd3],
            lightpink: [0xff, 0xb6, 0xc1],
            lightsalmon: [0xff, 0xa0, 0x7a],
            lightseagreen: [0x20, 0xb2, 0xaa],
            lightskyblue: [0x87, 0xce, 0xfa],
            lightslategray: [0x77, 0x88, 0x99],
            lightslategrey: [0x77, 0x88, 0x99],
            lightsteelblue: [0xb0, 0xc4, 0xde],
            lightyellow: [0xff, 0xff, 0xe0],
            lime: [0x00, 0xff, 0x00],
            limegreen: [0x32, 0xcd, 0x32],
            linen: [0xfa, 0xf0, 0xe6],
            magenta: [0xff, 0x00, 0xff],
            maroon: [0x80, 0x00, 0x00],
            mediumaquamarine: [0x66, 0xcd, 0xaa],
            mediumblue: [0x00, 0x00, 0xcd],
            mediumorchid: [0xba, 0x55, 0xd3],
            mediumpurple: [0x93, 0x70, 0xdb],
            mediumseagreen: [0x3c, 0xb3, 0x71],
            mediumslateblue: [0x7b, 0x68, 0xee],
            mediumspringgreen: [0x00, 0xfa, 0x9a],
            mediumturquoise: [0x48, 0xd1, 0xcc],
            mediumvioletred: [0xc7, 0x15, 0x85],
            midnightblue: [0x19, 0x19, 0x70],
            mintcream: [0xf5, 0xff, 0xfa],
            mistyrose: [0xff, 0xe4, 0xe1],
            moccasin: [0xff, 0xe4, 0xb5],
            navajowhite: [0xff, 0xde, 0xad],
            navy: [0x00, 0x00, 0x80],
            oldlace: [0xfd, 0xf5, 0xe6],
            olive: [0x80, 0x80, 0x00],
            olivedrab: [0x6b, 0x8e, 0x23],
            orange: [0xff, 0xa5, 0x00],
            orangered: [0xff, 0x45, 0x00],
            orchid: [0xda, 0x70, 0xd6],
            palegoldenrod: [0xee, 0xe8, 0xaa],
            palegreen: [0x98, 0xfb, 0x98],
            paleturquoise: [0xaf, 0xee, 0xee],
            palevioletred: [0xdb, 0x70, 0x93],
            papayawhip: [0xff, 0xef, 0xd5],
            peachpuff: [0xff, 0xda, 0xb9],
            peru: [0xcd, 0x85, 0x3f],
            pink: [0xff, 0xc0, 0xcb],
            plum: [0xdd, 0xa0, 0xdd],
            powderblue: [0xb0, 0xe0, 0xe6],
            purple: [0x80, 0x00, 0x80],
            red: [0xff, 0x00, 0x00],
            rosybrown: [0xbc, 0x8f, 0x8f],
            royalblue: [0x41, 0x69, 0xe1],
            saddlebrown: [0x8b, 0x45, 0x13],
            salmon: [0xfa, 0x80, 0x72],
            sandybrown: [0xf4, 0xa4, 0x60],
            seagreen: [0x2e, 0x8b, 0x57],
            seashell: [0xff, 0xf5, 0xee],
            sienna: [0xa0, 0x52, 0x2d],
            silver: [0xc0, 0xc0, 0xc0],
            skyblue: [0x87, 0xce, 0xeb],
            slateblue: [0x6a, 0x5a, 0xcd],
            slategray: [0x70, 0x80, 0x90],
            slategrey: [0x70, 0x80, 0x90],
            snow: [0xff, 0xfa, 0xfa],
            springgreen: [0x00, 0xff, 0x7f],
            steelblue: [0x46, 0x82, 0xb4],
            tan: [0xd2, 0xb4, 0x8c],
            teal: [0x00, 0x80, 0x80],
            thistle: [0xd8, 0xbf, 0xd8],
            tomato: [0xff, 0x63, 0x47],
            turquoise: [0x40, 0xe0, 0xd0],
            violet: [0xee, 0x82, 0xee],
            wheat: [0xf5, 0xde, 0xb3],
            white: [0xff, 0xff, 0xff],
            whitesmoke: [0xf5, 0xf5, 0xf5],
            yellow: [0xff, 0xff, 0x00],
            yellowgreen: [0x9a, 0xcd, 0x32]
        },

        RGBtoHSL: function (r, g, b) {
            var max = Math.max(r, g, b);
            var min = Math.min(r, g, b);
            var l = (max + min) / 2;
            var h = 0;
            var s = 0;
            if (max != min) {
                if (l < .5) {
                    s = (max - min) / (max + min);
                } else {
                    s = (max - min) / (2 - max - min);
                }
                if (r == max) {
                    h = (g - b) / (6 * (max - min));
                }
                if (g == max) {
                    h = (2.0 + (b - r) / (6 * (max - min)));
                }
                if (b == max) {
                    h = (4.0 + (r - g) / (6 * (max-min)));
                }
            }
            if (h < 0) {
                h += 1;
            }
            return [h, s, l];
        },

        getColorRGB: function (color) {
            if (typeof color == "undefined")
                return [0x00, 0x00, 0x00];
            
            // color = [red, green, blue]
            if (th.isArray(color) && color.length == 3)
                return [color[0], color[1], color[2]];

            if (!th.isString(color))
                throw "Error: th.Color.getColorRGB(): Function was passed a non string parameter";

            // color = "#RRGGBB"
            if (color.charAt(0) == '#') {
                var c = parseInt(color.slice(1), 16);
                return [c % 256, (c >> 8) % 256, (c >> 16) % 256];
            }
           
            // color = "rgb(red, green, blue)"
            if (color.indexOf("rgb(") == 0) {
                var c = color.match(/\d+/g);
                for (var i = 0; i < 3; i++) {
                    c[i] = parseInt(c[i]);
                    if (c[i] > 255) c[i] = 255;
                    if (c[i] < 0)   c[i] = 0;
                }
                return c;
            }
           
            // color = "rgba(red, green, blue, alpha)"
            // currently ignores the alpha channel. TODO: implement alpha
            if (color.indexOf("rgb(a") == 0) {
                var c = color.match(/\d+/g);
                for (var i = 0; i < 3; i++) {
                    c[i] = parseInt(c[i]);
                    if (c[i] > 255) c[i] = 255;
                    if (c[i] < 0)   c[i] = 0;
                }
                return c;
            }
           
            // default is black
            if (typeof this.colors[color] == "undefined")
                return [0x00, 0x00, 0x00]; 
           
            return this.colors[color];
        },

        getSpecial3DColors: function (fgColor, bgColor, type) {
            var f0, f1;
            var fg, bg;
            var fgBrightness, bgBrightness;
            
            fg = this.getColorRGB(fgColor);
            bg = this.getColorRGB(bgColor);

            fgBrightness = (3691 * fg[0] + 6283 * fg[1] + 2026 * fg[2]) / 12000;
            bgBrightness = (3691 * bg[0] + 6283 * bg[1] + 2026 * bg[2]) / 12000;
            
            if (bgBrightness < 51) {
                f0 = 30;
                f1 = 50;
                if (fgBrightness == 0) {
                    fg = [0x60, 0x60, 0x60];
                }
            } else if (bgBrightness > 204) {
                f0 = 45;
                f1 = 70;
                if(fgBrightness == 254) {
                    fg = [0xC0, 0xC0, 0xC0];
                }
            } else {
                f0 = 30 + (bgBrightness / 17);
                f1 = 50 + (bgBrightness * 20 / 255);
            }

            if (type == "dark") {
                for (var i = 0; i < 3; i++)
                    fg[i] -= Math.floor(fg[i] * f0 / 100);
            } else if (type == "light") {
                for (var i = 0; i < 3; i++)
                    fg[i] += Math.floor((255 - fg[i]) * f1 / 100);
            } else {
                 // default is black. XXX: not sure if it's the right decision, maybe returning undefined is better.
                fg = [0x00, 0x00, 0x00];
            }

            return fg;
        },

        getColorString: function (color) {
            return "rgb(" + color[0] + "," + color[1] + "," + color[2] + ")";
        }
    }
});

th.KeyHelpers = new Trait({
    methods: {
        // some keyCodes
        BACKSPACE: 8,
        TAB: 9,
        ENTER: 13,
        SHIFT: 16,
        CTRL: 17,
        ALT: 18,
        CAPS_LOCK: 20,
        ESCAPE: 27,
        SPACE: 32,
        PAGE_UP: 33,
        PAGE_DOWN: 34,
        END: 35,
        HOME: 36,
        ARROW_LEFT: 37,
        ARROW_UP: 38,
        ARROW_RIGHT: 39,
        ARROW_DOWN: 40,
        INSERT: 45,
        DELETE: 46, 

        A: 65,
        
        // function to bind keys to a given action within a given scope
        bindKey: function(modifiers, keyCode, action, scope) {
            if (scope === undefined) scope = this;

            var ctrlKey = (modifiers.toUpperCase().indexOf("CTRL") != -1);
            var altKey = (modifiers.toUpperCase().indexOf("ALT") != -1);
            var metaKey = (modifiers.toUpperCase().indexOf("META") != -1) || (modifiers.toUpperCase().indexOf("APPLE") != -1);
            var shiftKey = (modifiers.toUpperCase().indexOf("SHIFT") != -1);

            // Check for the platform specific key type
            // The magic "CMD" means metaKey for Mac (the APPLE or COMMAND key)
            // and ctrlKey for Windows (CONTROL)
            if (modifiers.toUpperCase().indexOf("CMD") != -1) {
                if (th.isMac()) {
                    metaKey = true;
                } else {
                    ctrlKey = true;
                }
            }

            this._keyHelpersMap[[keyCode, metaKey, ctrlKey, altKey, shiftKey]] = th.hitch(scope, action)
        },

        /*
            Take care: this = listener!
        */            
        _keyHelpersOnKeyDown: function(e) {
            this.isShiftDown = e.shiftKey;
            
            var action = this._keyHelpersMap[[e.keyCode, e.metaKey, e.ctrlKey, e.altKey, e.shiftKey]];

            if (th.isFunction(action)) {
                action(e);
                // if we handled the key, we want him to stop!
                th.stopEvent(e);
                return false;
            }
        },
        
        /*
            Take care: this = listener!
        */
        _keyHelpersOnKeyUp: function(e) {
            this.isShiftDown = false;
        },
        
        // I want this to be within init(), but this is not possible for Trait :(
        setupKeyHelpers: function() {
            this._keyHelpersMap = [];
            this.bus.bind("keydown", this, this._keyHelpersOnKeyDown, this);
            this.bus.bind("keyup", this, this._keyHelpersOnKeyUp, this);
        },
        
        getPrintableChar: function(e) {
            if (e.charCode > 255) return false;
            if (e.charCode < 32) return false;
            if ((e.altKey || e.metaKey || e.ctrlKey) && (e.charCode > 96 && e.charCode < 123)) return false;
            return String.fromCharCode(e.charCode);
        },
    }
});
