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

//= require "th"

if (typeof th == "undefined") th = {};

th.Panel = Class.define({
    type: "Panel",

    superclass: th.Container,

    members: {
        init: function(parms) {
            this._super(parms);
        },

        paintSelf: function(ctx) {
            this.paintBackground(ctx);
        }
    }
});

// Focus Manager doesn't support native dom controls at this point, so take this out!
//
// th.DomWrapper = Class.define({
//     type: 'DomWrapper',
//     
//     members: {
//         bus: null,  // th.bus to use
//         dom: null,  // ref to the underlaying dom component
//         focusManager: null, // set, when the component is added to the foucsManager by the focusManger itself
//         eventTravels: false,
//         
//         init: function (domComponent, bus) {
//             if (!bus) bus = th.global_event_bus;
//             this.bus = bus;
//             this.dom = domComponent;
//             th.observe(this.dom, "focus", this.onDOMFocus, this);
//             this.bus.bind("focus:received", this, this.onFocusReceived, this);
//             this.bus.bind("focus:canceled", this, this.onCanceledFocus, this);
//         },
//         
//         onDOMFocus: function(e) {   
//             // want to stop the event fired once again?
//             if (this.eventTravels)  return;
//             this.eventTravels = true;
//             this.focusManager.focus(this);
//         },
//                         
//         onCanceledFocus: function(e) {
//             this.eventTravels = false; 
//         },
//         
//         onFocusReceived: function(e) {
//             this.eventTravels = true;
//             this.dom.focus();
//             this.eventTravels = false;
//         },
//         
//         setFocusOrder: function(compNext, compPrev) {
//             if (!this.focusManager.hasSubscriber(compNext) || !this.focusManager.hasSubscriber(compPrev)) {
//                 console.error('setFocusOrder: component not subscribed!');
//             }
//             this.focusNext = compNext;
//             this.focusPrev = compPrev;
//         }
//     }
// });

th.Button = Class.define({
    type: "Button",

    superclass: th.Component,

    members: {
        init: function(parms) {
            if (!parms) parms = {};
            this._super(parms);

            this.orientation = parms.orientation || th.VERTICAL;
        },

        getPreferredSize: function() {
            var i = this.getInsets();
            var iw = i.left + i.right;
            var ih = i.top + i.bottom;

            // check for explicit height and width; if specified, that's the preferred size
            var height = this.cssValue("height");
            if (height !== undefined) height = th.convertLengthToPixels(height, this);

            var width = this.cssValue("width");
            if (width !== undefined) width = th.convertLengthToPixels(width, this);

            if (height !== undefined && width !== undefined) return { width: width + iw, height: height + ih };

            // check for top, mid, bot, and use them for preferred dimensions
            var im = this.tmb();
            if ((im) && (im.top && im.mid && im.bot)) {
                if (this.isVertical()) {
                    if (height === undefined) height = im.top.height + im.mid.height + im.bot.height;
                    if (width === undefined) width = im.top.width;
                } else {
                    if (height === undefined) height = im.top.height;
                    if (width === undefined) width = im.top.width + im.mid.width + im.bot.width;
                }
                return { width: width + iw, height: height + ih };
            }

            // check for a single background image and use it
            var img = this.getFirstBackgroundImage();
            if (img) {
                return { width: img.width + iw, height: img.height + ih };
            }

            return { width: iw, height: ih };
        },

        // short-cut method to return references to background images
        tmb: function() {
            var top = this.cssValue("-th-top-image");
            var mid = this.cssValue("-th-middle-image");
            var bot = this.cssValue("-th-bottom-image");

            if (top) top = th.global_resources.images[top];
            if (mid) mid = th.global_resources.images[mid];
            if (bot) bot = th.global_resources.images[bot];

            if (top && mid && bot) {
                return { top: top, mid: mid, bot: bot };
            }
        },

        paint: function(ctx) {
            var d = this.d();

            var imgs = this.tmb();
            if (!imgs) imgs = {};

            // if top, mid, bot images specified, we do the drawing ourselves
            if (imgs.top && imgs.mid && imgs.bot) {
                if (this.isVertical()) {
                    if (d.b.h >= imgs.top.height + imgs.bot.height) {
                        ctx.drawImage(imgs.top, 0, 0);
                        if (d.b.h > imgs.top.height + imgs.bot.height) {
                            ctx.drawImage(imgs.mid, 0, imgs.top.height, imgs.mid.width, d.b.h - imgs.top.height - imgs.bot.height);
                        }
                        ctx.drawImage(imgs.bot, 0, d.b.h - imgs.bot.height);
                    }
                } else {
                    if (d.b.w >= imgs.top.width + imgs.bot.width) {
                        ctx.drawImage(imgs.top, 0, 0);
                        if (d.b.w > imgs.top.width + imgs.bot.width) {
                            ctx.drawImage(imgs.mid, imgs.top.width, 0, d.b.w - imgs.top.width - imgs.bot.width, imgs.mid.height);
                        }
                        ctx.drawImage(imgs.bot, d.b.w - imgs.bot.width, 0);
                    }
                }
            } else {    // otherwise delegate to the normal background painting routine
                this.paintBackground(ctx);
            }
        }
    }
});

// TODO: I added the VerticalScrollbar and HorizontalScrollbar subclasses after this component was nearly done; much of the
// branching code in Scrollbar could be pushed down to its subclasses
th.Scrollbar = Class.define({
    type: "Scrollbar",

    superclass: th.Container,

    members: {
        init: function(parms) {
            if (!parms) parms = {};

            this._super(parms);

            this.orientation = parms.orientation || th.VERTICAL;

            this.value = parms.value || 0;
            this.min = parms.min || 0;
            this.max = parms.max || 100;
            this.extent = parms.extent || 0.1;
            this.increment = parms.increment || 2;

            this.up = new th.Button({ className: "up" });
            this.down = new th.Button({ className: "down" });
            this.bar = new th.Button({ className: "bar" });
            this.add([ this.up, this.down, this.bar ]);

            this.bus.bind("click", this.up, this.scrollup, this);
            this.bus.bind("click", this.down, this.scrolldown, this);
            this.bus.bind("mousedrag", this.bar, this.onmousedrag, this);
            this.bus.bind("mouseup", this.bar, this.onmouseup, this);
        },

        // subclasses override this
        getPixelRange: function() {},

        setValue: function(value) {
            if (value < this.min) {
                this.value = this.min;
            } else if (value > this.max) {
                this.value = this.max;
            } else {
                this.value = value;
            }
            this.bus.fire("scroll", { min: this.min, max: this.max, value: this.value }, this);
        },

        onmousedrag: function(e) {
            var currentPosition = (this.isVertical()) ? e.clientY : e.clientX;

            // to properly calculate where the scrollbar go while the user is dragging it, we need to know where it was when the
            // user started dragging it and we need to do where the cursor was when the drag started
            if (this.dragstart_value == undefined) {
                this.dragstart_value = this.value;
                this.dragstart_mouse = currentPosition;
                return;
            }

            var diff = currentPosition - this.dragstart_mouse;  // difference in pixels; needs to be translated to a difference in value

             // total number of pixels that map to the value range
            var pixel_range = this.getPixelRange();

            var pixel_to_value_ratio = (this.max - this.min) / pixel_range;

            this.setValue(this.dragstart_value + Math.floor(diff * pixel_to_value_ratio));

            this.render();
        },

        onmouseup: function(e) {
            delete this.dragstart_value;
            delete this.dragstart_mouse;
        },

        scrollup: function(e) {
            if (this.value > this.min) {
                this.setValue(Math.max(0, this.value - this.increment));
                this.render();
            }
        },

        scrolldown: function(e) {
            if (this.value < this.max) {
                this.setValue(Math.min(this.max, this.value + this.increment));
                this.render();
            }
        },

        // short-cut method to return references to background images
        tmb: function() {
            var top = this.cssValue("-th-top-image");
            var mid = this.cssValue("-th-middle-image");
            var bot = this.cssValue("-th-bottom-image");

            if (top) top = th.global_resources.images[top];
            if (mid) mid = th.global_resources.images[mid];
            if (bot) bot = th.global_resources.images[bot];

            if (top && mid && bot) {
                return { top: top, mid: mid, bot: bot };
            }
        },

        getPreferredSize: function() {
            var i = this.getInsets();
            var iw = i.left + i.right;
            var ih = i.top + i.bottom;

            // check for explicit height and width; if specified, that's the preferred size
            var height = this.cssValue("height");
            if (height !== undefined) height = th.convertLengthToPixels(height, this);

            var width = this.cssValue("width");
            if (width !== undefined) width = th.convertLengthToPixels(width, this);

            if (height !== undefined && width !== undefined) return { width: width + iw, height: height + ih };

            // check for top, mid, bot, and use them for preferred dimensions
            var im = this.tmb();
            if (im.top && im.mid && im.bot) {
                if (this.isVertical()) {
                    if (height === undefined) height = im.top.height + im.mid.height + im.bot.height;
                    if (width === undefined) width = im.top.width;
                } else {
                    if (height === undefined) height = im.top.height;
                    if (width === undefined) width = im.top.width + im.mid.width + im.bot.width;
                }
                return { width: width + iw, height: height + ih };
            }
        },

        // ORIENTATION
        layout: function() {
            var d = this.d();

            // update the bar's orientation
            this.bar.orientation = this.orientation;

            // if the maximum value is less than the minimum, we're in an invalid state and won't paint anything
            if (this.max < this.min) {
                console.error("scrollbar max is less than min; can't do layout", this);
                for (var i = 0; i < this.children.length; i++) delete this.children[i].bounds;
                return;
            }

            if (this.orientation == th.VERTICAL) {
                var w = d.b.iw;
                var h = this.up.getPreferredSize().height;
                this.up.setBounds(d.i.l, d.i.t, w, h);
                this.down.setBounds(d.i.l, d.b.ih - h, w, h);

                var scroll_track_height = d.b.ih - this.up.bounds.height - this.down.bounds.height;

                var extent_length = Math.min(Math.ceil(scroll_track_height / (1 + this.extent), scroll_track_height));
                
                if (this.max != this.value) {
                    var extent_top = Math.ceil(this.up.bounds.height + Math.min( (this.value * scroll_track_height * this.extent / (this.max * (1 + this.extent))) ));

                    // make sure that the scrollbar is in a valid position; if it has overflowed, reset it to the bottom and
                    // set the scrollable to its own bottom
                    var overflow = (extent_top + extent_length) - this.down.bounds.y;
                    if (overflow > 0) {
                        extent_top -= overflow;
                    }
                } else {
                    // this makes the scrollbar looks much nicer of the maxium is reached
                    var extent_top = this.down.bounds.y - extent_length + 1;
                }

                this.bar.setBounds(d.i.l, extent_top, d.b.iw, extent_length);
            } else {
                var w = this.up.getPreferredSize().width;
                var h = d.b.ih;
                this.up.setBounds(d.i.l, d.i.t, w, h);
                this.down.setBounds(d.b.iw - w, d.i.t, w, h);

                var scroll_track_width = d.b.iw - this.up.bounds.width - this.down.bounds.width;

                var extent_length = Math.min(Math.floor(scroll_track_width / (1 + this.extent), scroll_track_width));
                var extent_top = Math.floor(this.up.bounds.height + Math.min( (this.value * scroll_track_width * this.extent / (this.max * (1 + this.extent))) ));

                // make sure that the scrollbar is in a valid position; if it has overflowed, reset it to the bottom and
                // set the scrollable to its own bottom
                var overflow = (extent_top + extent_length) - this.down.bounds.x;
                if (overflow > 0) {
                    extent_top -= overflow;
                }

                this.bar.setBounds(extent_top, d.i.t, extent_length, d.b.ih);
            }
        },

        paint: function(ctx) {
            if (this.max < 0) return;

            // update the bar's orientation
            this.bar.orientation = this.orientation;

            this.paintTrack(ctx);

            this._super(ctx);
        },

        paintTrack: function(ctx) {}
    }
});

th.VerticalScrollbar = Class.define({
    type: "VerticalScrollbar",

    superclass: th.Scrollbar,

    members: {
        init: function(parms) {
            if (!parms) parms = {};

            parms.orientation = th.VERTICAL;

            this._super(parms);
        },

        getPixelRange: function() {
            var d = this.d();
            return d.b.ih - this.up.bounds.height - this.down.bounds.height - this.bar.bounds.height;
        },

        paintTrack: function(ctx) {
            var d = this.d();

            var imgs = this.tmb();
            if (!imgs) return;

            // paint the track
            if (imgs.top) ctx.drawImage(imgs.top, d.i.l, this.up.bounds.height);
            if (imgs.mid) ctx.drawImage(imgs.mid, d.i.l, this.up.bounds.height + imgs.top.height, imgs.mid.width, this.down.bounds.y - this.down.bounds.height - (this.up.bounds.x - this.up.bounds.height));
            if (imgs.bot) ctx.drawImage(imgs.bot, d.i.l, this.down.bounds.y - imgs.bot.height);
        }
    }
});

th.HorizontalScrollbar = Class.define({
    type: "HorizontalScrollbar",

    superclass: th.Scrollbar,

    members: {
        init: function(parms) {
            if (!parms) parms = {};

            parms.orientation = th.HORIZONTAL;

            this._super(parms);
        },

        getPixelRange: function() {
            var d = this.d();
            return d.b.iw - this.up.bounds.width - this.down.bounds.width - this.bar.bounds.width;
        },

        paintTrack: function(ctx) {
            var d = this.d();

            var imgs = this.tmb();
            if (!imgs) return;

            // paint the track
            if (imgs.top) ctx.drawImage(imgs.top, this.up.bounds.width, d.i.t);
            if (imgs.mid) ctx.drawImage(imgs.mid, this.up.bounds.width + imgs.top.width, d.i.t, this.down.bounds.x - (this.up.bounds.x + this.up.bounds.width), imgs.mid.height);
            if (imgs.bot) ctx.drawImage(imgs.bot, this.down.bounds.x - imgs.bot.width, d.i.t);
        }
    }
});

th.ResizeNib = Class.define({
    type: "ResizeNib",

    superclass: th.Component,

    members: {
        init: function(parms) {
            this._super(parms);

            this.bus.bind("mousedown", this, this.onmousedown, this);
            this.bus.bind("mouseup", this, this.onmouseup, this);
            this.bus.bind("mousedrag", this, this.onmousedrag, this);
        },

        onmousedown: function(e) {
            this.startPos = { x: e.clientX, y: e.clientY};
        },

        onmousedrag: function(e) {
            if (this.startPos) {
                if (!this.firedDragStart) {
                    this.bus.fire("dragstart", this.startPos, this);
                    this.firedDragStart = true;
                }

                this.bus.fire("drag", { startPos: this.startPos, currentPos: { x: e.clientX, y: e.clientY } }, this);
            }
        },

        onmouseup: function(e) {
            if (this.startPos && this.firedDragStart) {
                this.bus.fire("dragstop", { startPos: this.startPos, currentPos: { x: e.clientX, y: e.clientY } }, this);
                delete this.firedDragStart;
            }
            delete this.startPos;
        },

        paint: function(ctx) {
            var d = this.d();

            if (this.orientation == th.VERTICAL) {
                var bw = 7;
                var x = Math.floor((d.b.w / 2) - (bw / 2));
                var y = 7;

                ctx.fillStyle = this.cssValue("-th-vertical-bar-shadow-color");
                for (var i = 0; i < 3; i++) {
                    ctx.fillRect(x, y, bw, 1);
                    y += 3;
                }

                y = 8;
                ctx.fillStyle = this.cssValue("-th-vertical-bar-color");
                for (var i = 0; i < 3; i++) {
                    ctx.fillRect(x, y, bw, 1);
                    y += 3;
                }
            } else {
                var bh = 7;

                var dw = 8; // width of the bar area
                var dh = bh + 2; // height of the bar area

                var x = Math.floor(d.b.w / 2 - (dw / 2));
                var y = Math.floor(d.b.h / 2 - (dh / 2));

                // lay down the shadowy bits
                var cx = x;

                if (this.cssValue("-th-horizontal-bar-subtle-shadow-color")) {
                    ctx.fillStyle = this.cssValue("-th-horizontal-bar-subtle-shadow-color");
                    for (var i = 0; i < 3; i++) {
                        ctx.fillRect(cx, y, 1, dh);
                        cx += 3;
                    }
                }

                // lay down the black shadow
                cx = x + 1;
                ctx.fillStyle = this.cssValue("-th-horizontal-bar-shadow-color");
                for (var i = 0; i < 3; i++) {
                    ctx.fillRect(cx, y + dh - 1, 1, 1);
                    cx += 3;
                }

                // draw the bars
                cx = x + 1;
                ctx.fillStyle = this.cssValue("-th-horizontal-bar-color");
                for (var i = 0; i < 3; i++) {
                    ctx.fillRect(cx, y + 1, 1, bh);
                    cx += 3;
                }
            }
        }
    }
});

/*
    A "splitter" that visually demarcates areas of an interface. Can also have some "nibs" on its ends to facilitate resizing.
    Provides "dragstart", "drag", and "dragstop" events that are fired when a nib is dragged. Orientation is in terms of a container and
    is confusing; HORIZONTAL means the splitter is actually displayed taller than wide--what might be called vertically, and similarly
    VERTICAL means the splitter is wider than it is tall, i.e., horizontally. This is because the *container* is laid out such that
    different regions are stacked horizontally or vertically, and the splitter demarcates those areas.

    This bit of confusion was deemed better than having the orientation for a hierarchy of components be different but contributing to the
    same end.

    Note also that this component uses getPreferredHeight() and getPreferredWidth() differently than most; only one of the methods is
    valid for a particular orientation. I.e., when in HORIZONTAL orientation, getPreferredWidth() should be used and getPreferredHeight()
    ignored.

 */
th.Splitter = Class.define({
    type: "Splitter",

    superclass: th.Panel,

    members: {
        init: function(parms) {
            this._super(parms);

            this.opaque = false;

            this.topNib = new th.ResizeNib({ orientation: this.orientation } );
            this.bottomNib = new th.ResizeNib({ orientation: this.orientation } );
            this.add(this.topNib, this.bottomNib);

            this.label = parms.label;
            if (this.label) this.add(this.label);

            this.scrollbar = parms.scrollbar;
            if (this.scrollbar) this.add(this.scrollbar);

            this.bus.bind("drag", [ this.topNib, this.bottomNib ], this.ondrag, this);
            this.bus.bind("dragstart", [ this.topNib, this.bottomNib ], this.ondragstart, this);
            this.bus.bind("dragstop", [ this.topNib, this.bottomNib ], this.ondragstop, this);
        },

        ondrag: function(e) {
            this.bus.fire("drag", e, this);
        },

        ondragstart: function(e) {
            this.bus.fire("dragstart", e, this);
        },

        ondragstop: function(e) {
            this.bus.fire("dragstop", e, this);
        },

        getPreferredSize: function() {
            var i = this.getInsets();
            var iw = i.left + i.right;
            var ih = i.top + i.bottom;

            // check for explicit height and width; if specified, that's the preferred size
            var height = this.cssValue("height");
            if (height !== undefined) height = th.convertLengthToPixels(height, this);

            var width = this.cssValue("width");
            if (width !== undefined) width = th.convertLengthToPixels(width, this);

            if (height !== undefined && width !== undefined) return { width: width + iw, height: height + ih };

            // check for a scrollbar; if present, use it
            if (this.scrollbar && this.scrollbar.shouldLayout() ) {
                var pref = this.scrollbar.getPreferredSize();
                if (pref) return { width: pref.width + iw, height: pref.height + ih };
            }

            // no scrollbar? fall back on defaults
            return { width: (width === undefined) ? iw : width + iw, height: (height === undefined) ? ih : height + ih };
        },

        layout: function() {
            var d = this.d();

            // if the orientation isn't explicitly set, guess it by examining the ratio
            if (!this.orientation) this.orientation = (this.bounds.height > this.bounds.width) ? th.HORIZONTAL : th.VERTICAL;

            if (this.orientation == th.HORIZONTAL) {
                this.topNib.setBounds(d.i.l, d.i.t, d.b.iw, d.b.iw);
                this.bottomNib.setBounds(d.i.l, d.b.ih - d.b.iw, d.b.iw, d.b.iw);

                if (this.scrollbar && this.scrollbar.shouldLayout()) {
                    this.scrollbar.setBounds(d.i.l, this.topNib.bounds.height, d.b.iw, d.b.ih - (this.topNib.bounds.height * 2));
                }
            } else {
                this.topNib.setBounds(d.i.l, d.i.t, d.b.ih, d.b.ih);
                this.bottomNib.setBounds(d.b.iw - d.b.ih, d.i.t, d.b.ih, d.b.ih);

                if (this.label) {
                    this.label.setBounds(this.topNib.bounds.x + this.topNib.bounds.width, d.i.t, d.b.iw - (d.b.ih * 2), d.b.ih);
                }
            }
        }
    }
});

th.VerticalSplitter = Class.define({
    type: "VerticalSplitter",

    superclass: th.Splitter,

    members: {
        init: function(parms) {
            if (!parms) parms = {};
            parms.orientation = th.HORIZONTAL;
            this._super(parms);
        }
    }
});

th.SplitPanelContainer = Class.define({
    type: "SplitPanelContainer",

    superclass: th.Panel,

    members: {
        init: function(parms) {
            this._super(parms);

            this.splitter = new th.Splitter({ orientation: this.orientation, label: parms.label });
        },

        getContents: function() {
            var childrenWithoutSplitter = th.remove(this.children, this.splitter);
            if (childrenWithoutSplitter.length > 0) return childrenWithoutSplitter[0];
        },

        layout: function() {
            var childrenWithoutSplitter = th.remove(this.children, this.splitter);
            if (this.children.length == childrenWithoutSplitter.length) this.add(this.splitter);

            var prefSize = this.splitter.getPreferredSize();
            var slength = (this.orientation == th.HORIZONTAL) ?
                          prefSize.width :
                          prefSize.height;
            if (this.splitter.shouldLayout()) {
                if (this.orientation == th.HORIZONTAL) {
                    this.splitter.setBounds(this.bounds.width - slength, 0, slength, this.bounds.height);
                } else {
                    this.splitter.setBounds(0, this.bounds.height - slength, this.bounds.width, slength);
                }
            } else {
                slength = 0;
            }

            // only the first non-splitter child is laid out
            if (childrenWithoutSplitter.length > 0) {
                if (this.orientation == th.HORIZONTAL) {
                    childrenWithoutSplitter[0].setBounds(0, 0, this.bounds.width - slength, this.bounds.height);
                } else {
                    childrenWithoutSplitter[0].setBounds(0, 0, this.bounds.width, this.bounds.height - slength);
                }
            }
        }
    }
});

/*
    A component that allocates all visible space to two or more nested regions.
 */
th.SplitPanel = Class.define({
    type: "SplitPanel",

    superclass: th.Panel,

    uses: [
        th.StringHelpers
    ],

    members: {
        init: function(parms) {
            this._super(parms);

            if (!this.orientation) this.orientation = th.HORIZONTAL;

            if (!this.regions) this.regions = [{},{}];
        },

        ondragstart: function(e) {
            var container = e.thComponent.parent; // splitter -> splitpanecontainer
            container.region.startSize = container.region.size;
        },

        ondrag: function(e) {
            var container = e.thComponent.parent; // splitter -> splitpanecontainer

            var delta = (this.orientation == th.HORIZONTAL) ? e.currentPos.x - e.startPos.x : e.currentPos.y - e.startPos.y;

            container.region.size = container.region.startSize + delta;
            this.render();
        },

        ondragstop: function(e) {
            var container = e.thComponent.parent; // splitter -> splitpanecontainer
            delete container.region.startSize;
        },

        layout: function() {
            this.remove(this.children); // remove any of the existing region panels

            /*
               iterate through each region, performing a couple of tasks:
                - create a container for each region if it doesn't already have one
                - put the value of the contents property of region into the container if necessary
                - hide the splitter on the last region
             */
            for (var i = 0; i < this.regions.length; i++) {
                var region = this.regions[i];
                if (!region.container) {
                    region.container = new th.SplitPanelContainer({ orientation: this.orientation, label: region.label });

                    region.container.region = region;   // give the container a reference back to the region

                    // capture the start size of the region when the nib's drag starts
                    this.bus.bind("dragstart", region.container.splitter, this.ondragstart, this);
                    this.bus.bind("drag", region.container.splitter, this.ondrag, this);
                    this.bus.bind("dragstop", region.container.splitter, this.ondragstop, this);
                }

                // update the content panel for the split panel container
                if (region.contents && (region.contents != region.container.getContents())) {
                    region.container.removeAll();
                    region.container.add(region.contents);
                }

                // make the last container's splitter invisible
                if (i == this.regions.length - 1) region.container.splitter.addCss("display", "none");

                this.add(region.container);
            }

            var containerSize = (this.orientation == th.HORIZONTAL) ? this.bounds.width : this.bounds.height;

            // size the regions
            var totalSize = 0;
            for (var i = 0; i < this.regions.length; i++) {
                var r = this.regions[i];

                if (!r.size) {
                    r.size = (this.defaultSize || (100 / this.regions.length) + "%");
                }

                if (this.isPercentage(r.size)) {
                    // percentage lengths are allowed, but will be immediately converted to pixels
                    r.size = Math.floor((parseInt(r.size) / 100) * containerSize);
                }

                // enforce a minimum width
                if (r.size < 30) r.size = 30;

                totalSize += r.size;
            }
            if (totalSize > containerSize) {   // if the regions are bigger than the split pane size, shrink 'em, right-to-left
                var diff = totalSize - containerSize;
                for (var i = this.regions.length - 1; i >= 0; i--) {
                    var r = this.regions[i];

                    var originalSize = r.size;
                    r.size -= diff;
                    if (r.size < 30) r.size = 30;
                    diff -= (originalSize - r.size);

                    if (diff <= 0) break;
                }
            } else if (totalSize < containerSize) {    // if the regions are smaller, grow 'em, all in the last one
                var r = this.regions[this.regions.length - 1].size += (containerSize - totalSize);
            }

            var startPx = 0;
            for (var i = 0; i < this.regions.length; i++) {
                var region = this.regions[i];
                if (this.orientation == th.HORIZONTAL) {
                    region.container.setBounds(startPx, 0, region.size, this.bounds.height);
                } else {
                    region.container.setBounds(0, startPx, this.bounds.width, region.size);
                }
                startPx += region.size;

            }
        }
    }
});

th.Label = Class.define({
    type: "Label",

    superclass: th.Panel,

    members: {
        init: function(parms) {
            if (!parms) parms = {};

            this._super(parms);

            this.text = parms.text || "";
        },

        styleContext: function(ctx) {
            if (!ctx) return;

            ctx.font = this.cssValue("font");
            ctx.fillStyle = this.cssValue("color");

            return ctx;
        },

        getPreferredSize: function() {
            var ctx = this.styleContext(this.parent.getScratchContext());
            var i = this.getInsets();

            // the +2 is to compensate for anti-aliasing on Windows, which isn't taken into account in measurements; this fudge factor should eventually become platform-specific
            var w = ctx.measureText(this.text).width + 2;
            w += i.left + i.right;

            var h = Math.floor(ctx.measureText(this.text).ascent * 1.5);   // multiplying by 2 to fake a descent and leading
            h += i.top + i.bottom;

            return { height: h, width: w };
        },

        paint: function(ctx) {
            // paint the panel background
            this._super(ctx);

            var d = this.d();

            this.styleContext(ctx);

            var textMetrics = ctx.measureText(this.text);
            
            var y = d.i.t + textMetrics.ascent;
            if (th.browser.WebKit) y += 1;  // strings are one pixel too high in Safari 4 and Webkit nightly

            if (textMetrics.width <= (d.b.w - d.i.w)) {
                // we can only care about left, middle, right, if we don't have to trim the label!
                var x;
                var textAlign = this.cssValue('text-align') || 'left';
                switch (textAlign) {
                    case 'start':
                    case 'left':
                        x = d.i.l;
                        break;
                    case 'center':
                        x = d.i.l + ((d.b.iw - textMetrics.width) / 2);
                        break;
                    case 'end':
                    case 'right': 
                        x = d.i.l + d.b.iw - textMetrics.width;
                        break;
                    default:
                        console.error('orientation "' + this.orientation  + '"???');
                        break;
                }
                ctx.fillText(this.text, x, y);
            } else {
                if (this.text === undefined) this.text = "";
                var textToRender = this.text;
                var lastLength = textToRender.length - 2;
                while (textMetrics.width > (d.b.iw)) {
                    if (lastLength <= 0) {
                        if (this.text.length > 1) {
                            textToRender = "...";
                        } else {
                            textToRender = this.text;
                        }
                        break;
                    }

                    var left = Math.floor(lastLength / 2);
                    var right = left + (lastLength % 2);
                    textToRender = this.text.substring(0, left) + "..." + this.text.substring(this.text.length - right);
                    textMetrics = ctx.measureText(textToRender);

                    lastLength -= 1;
                }
                ctx.fillText(textToRender, d.i.l, y);
            }
        }
    }
});

th.Input = Class.define({
    type: "input",

    superclass: th.Panel,
    
    uses: [
        th.KeyHelpers
    ],

    members: {
        init: function(parms) {
            if (!parms) parms = {};

            this._super(parms);

            this.text = parms.text || "";
            
            // this is not in use yet, but will be in the future
            this.xOff = 0;
            
            this.isMouseDown = false;
            
            // stuff for toggling the Cursor
            this.isCursorVisible = false;
            this.cursorTimer = undefined;
            this.cursorTogglePeriod = 600;
            
            // be careful! this.selStart can be > then this.selEnd. Use this.selRelStart if you need this.selStart always beeing < this.selEnd!
            this.selStart = this.text.length;
            this.selEnd = this.selStart;
            
            this.selRelStart = this.selStart;
            this.selRelEnd = this.selEnd;
            
            // bind to bus-events
            this.bus.bind("keypress", this, this.onKeyPress, this);
            this.bus.bind("mousedown", this, this.onMouseDown, this);
            this.bus.bind("mousemove", this, this.onMouseMove, this);
            this.bus.bind("mouseup", this, this.onMouseUp, this);
            this.bus.bind("dblclick", this, this.onMouseDoubleClick, this);
            
            // bind key combinations to certain actions.
            // *make* sure to call this.key.setupEvents(this) first
            this.setupKeyHelpers();
            
            this.bindKey("", this.ARROW_LEFT, this.actions.moveCursorLeft);
            this.bindKey("SHIFT", this.ARROW_LEFT, this.actions.moveCursorLeft);
            this.bindKey("CMD", this.ARROW_LEFT, this.actions.moveCursorBeginning);
            this.bindKey("CMD SHIFT", this.ARROW_LEFT, this.actions.moveCursorBeginning);
            
            this.bindKey("", this.ARROW_RIGHT, this.actions.moveCursorRight);
            this.bindKey("SHIFT", this.ARROW_RIGHT, this.actions.moveCursorRight);
            this.bindKey("CMD", this.ARROW_RIGHT, this.actions.moveCursorEnd);
            this.bindKey("CMD SHIFT", this.ARROW_RIGHT, this.actions.moveCursorEnd);
            
            this.bindKey("", this.BACKSPACE, this.actions.backspace);
            this.bindKey("", this.DELETE, this.actions.deleteKey);
            this.bindKey("CMD", this.A, this.selectAll);
            
            // bind to focusEvents, to start and stop cursor toggeling
            this.bus.bind("focus:received", this, this.receivedFocus, this);
            this.bus.bind("focus:lost", this, this.lostFocus, this);
        },
        
        receivedFocus: function() {
            this.isCursorVisible = false;
            clearTimeout(this.cursorTimer); 
            this.toggleCursor();
        },
        
        lostFocus: function() {
            this.isCursorVisible = false; 
            clearTimeout(this.cursorTimer); 
            delete this.cursorTimer;
            setTimeout(th.hitch(this,function(){ this.repaint(); }), 1);
        },
        
        actions: {
            moveCursorLeft: function(e) {
                if (this.selStart != this.selEnd && !e.shiftKey) {
                    this.setSelection(this.selRelStart, undefined, false);                                                    
                } else {
                    this.setSelection(Math.max(--this.selStart, 0), (e.shiftKey ? this.selEnd : undefined), false);                                                    
                }
            },
            
            moveCursorRight: function(e) {
                if (this.selStart != this.selEnd && !e.shiftKey) {
                    this.setSelection(this.selRelEnd, undefined, false);                                                                                
                } else {
                    this.setSelection(Math.max(++this.selStart, 0), (e.shiftKey ? this.selEnd : undefined), false);                                                    
                }
            },
            
            moveCursorBeginning: function(e) {
                this.setSelection(0, (e.shiftKey ? this.selEnd : undefined), true);            
            },
            
            moveCursorEnd: function(e) {
                this.setSelection(this.text.length, (e.shiftKey ? this.selEnd : undefined), true);
            },
            
            backspace: function(e) {
                if (this.selStart == this.selEnd) {
                    this.text = this.text.substring(0, this.selRelStart - 1) +  this.text.substring(this.selRelEnd);
                    this.setSelection(--this.selRelStart, undefined, true);
                } else {
                    this.text = this.text.substring(0, this.selRelStart) +  this.text.substring(this.selRelEnd);
                    this.setSelection(this.selRelStart, undefined, true);
                }
                
                this.bus.fire("text:changed", { text: this.text }, this);
            },
            
            deleteKey: function(e) {
                if (this.selStart == this.selEnd) {
                    this.text = this.text.substring(0, this.selRelStart) +  this.text.substring(this.selRelEnd + 1);
                    this.setSelection(this.selRelStart, undefined, true);
                    // in this case, the selection might not change, but the content do so
                    // => call this.repaint() on our own
                    this.repaint();                                                
                } else {
                    this.text = this.text.substring(0, this.selRelStart) +  this.text.substring(this.selRelEnd);
                    this.setSelection(this.selRelStart, undefined, true);                        
                }
                
                this.bus.fire("text:changed", { text: this.text }, this);
            }
        },
        
        performCopy: function() {
            if (this.selStart == this.selEnd) return false;
            return this.getSelectedText();
        },
        
        performCut: function() {
            if (this.selStart == this.selEnd) return false;
            var result = this.getSelectedText();
            this.text = this.text.substring(0, this.selRelStart) +  this.text.substring(this.selRelEnd);
            this.selEnd = this.selStart
            this.repaint();
            
            this.bus.fire("text:changed", { text: this.text }, this);
            
            return result;
        },
        
        performPaste: function(text) {
            this.text = this.text.substring(0, this.selRelStart) + text + this.text.substring(this.selRelEnd);
            this.setSelection(this.selRelStart + text.length, undefined);
            
            this.bus.fire("text:changed", { text: this.text }, this);
        },
        
        setSelection: function(newSelStart, newSelEnd, cursorOnEdges) {
            if (newSelEnd === undefined)    newSelEnd = newSelStart;
            if (cursorOnEdges === undefined) cursorOnEdges = true;
            
            this.selStart = Math.max(Math.min(newSelStart, this.text.length), 0);
            this.selEnd = Math.max(Math.min(newSelEnd, this.text.length), 0);
            
            var oldSelRelStart = this.selRelStart;
            var oldSelRelEnd = this.selRelEnd;
            
            if (this.selStart > this.selEnd) {
                this.selRelStart = this.selEnd;
                this.selRelEnd = this.selStart;
            } else {
                this.selRelStart = this.selStart;
                this.selRelEnd = this.selEnd;
            }
            
            if (oldSelRelStart != this.selRelStart || oldSelRelEnd != this.selRelEnd) {
                // the selection has changed, so we have to
                
                // #1: make sure the cursor is within the current view
                if (this.selStart != 0) {
                    var d = this.d();
                    var ctx = this.styleContext(this.parent.getScratchContext());
                    this.styleContext(ctx);
                    var width = ctx.measureText(this.text.substring(0, this.selStart)).width;
                    if ((this.xOff + width) > d.b.iw) {
                        if (!cursorOnEdges) {
                            this.xOff = Math.max(this.xOff - Math.round(d.b.iw / 2), - ctx.measureText(this.text).width + d.b.iw);
                        } else {
                             this.xOff = d.b.iw - width;   
                        }
                    }
                    var width = ctx.measureText(this.text.substring(0, this.selStart)).width;
                    if ((this.xOff + width) <= 0) {
                        if (!cursorOnEdges) {
                            this.xOff = Math.min(this.xOff + Math.round(d.b.iw / 2) , 0);
                        } else {
                            this.xOff = d.i.l - width;
                        }
                    }
                } else {
                    this.xOff = 0;
                }
                
                // #2 repaint the component
                
                // this is a little bit of *fake*
                // we restart the toggleTimer, set the visibility to false and call toggleCursor
                // this sets the cursor's visibility to true again, kicks of a new timer and call repaint()!
                if (this.cursorTimer) {
                    clearTimeout(this.cursorTimer);
                    this.isCursorVisible = false;
                    this.toggleCursor();                                             
                } else {
                    this.repaint();
                }
            }
        },
        
        selectAll: function() {
            this.setSelection(0, this.text.length);
        },
        
        getSelectedText: function() {
            return this.text.substring(this.selRelStart, this.selRelEnd)
        },
        
        setText: function(text, suppressTextChangedEvent) {
            this.text = text;
            this.setSelection(text.length);
            
            if (!suppressTextChangedEvent) {
                this.bus.fire("text:changed", { text: this.text }, this);                
            }
        },
        
        getPosForPosition: function(posX) {
            var ctx = this.styleContext(this.parent.getScratchContext());
            this.styleContext(ctx);
            
            var x;
            var relXOff = this.xOff + this.d().i.l;
            var xOff = relXOff;
            
            for (x = 1; x < this.text.length + 1 && xOff < posX; x++) {
                xOff = relXOff + ctx.measureText(this.text.substring(0, x)).width;
            }
            
            return x - 1;
        },
        
        onMouseDown: function(e) {
            if (this.focusManager !== undefined) {
                if (!this.focusManager.focus(this)) {
                    // in this case someone doesn't want the component to get focused...
                    th.stopEvent(e);
                    return;
                }
            }
            
            this.isMouseDown = true;
            this.setSelection(this.getPosForPosition(e.componentX), (this.isShiftDown ? this.selRelEnd : undefined));
            
            th.stopEvent(e);
        },
        
        onMouseMove: function(e) {
            if (this.isMouseDown) {
                this.setSelection(this.getPosForPosition(e.componentX), this.selEnd);
            }   
        },
        
        onMouseUp: function(e) {
            this.isMouseDown = false;
        },
        
        onMouseDoubleClick: function(e) {
            var x = this.getPosForPosition(e.componentX);
            var start = x;
            for (start; start != -1 && this.text[start] != ' '; start --) {}
            
            var end = this.text.indexOf(' ', x);
            end = ( end == -1 ? this.text.length : end);
            
            this.setSelection(++start, end);
        },
                                        
        onKeyPress: function(e) {
            var charToPrint = this.getPrintableChar(e);

            if (charToPrint) {
                // inser the char!
                this.text = this.text.substring(0, this.selRelStart) + charToPrint + this.text.substring(this.selRelEnd);
                this.setSelection(++this.selStart);
                
                this.bus.fire("text:changed", { text: this.text }, this);
                this.bus.fire("text:changed:newChar", { text: this.text, newChar: charToPrint }, this);
            }
        },
        
        toggleCursor: function() {
            this.isCursorVisible = !this.isCursorVisible;
            this.repaint();
            this.cursorTimer = setTimeout(th.hitch(this, this.toggleCursor), this.cursorTogglePeriod);
        },

        styleContext: function(ctx) {
            if (!ctx) return;

            ctx.font = this.cssValue("font");
            ctx.fillStyle = this.cssValue("color");

            return ctx;
        },

        getPreferredSize: function() {
            var ctx = this.styleContext(this.parent.getScratchContext());
            var i = this.getInsets();

            // the +2 is to compensate for anti-aliasing on Windows, which isn't taken into account in measurements; this fudge factor should eventually become platform-specific
            var w = ctx.measureText(this.text).width + 2;
            w += i.left + i.right;

            var h = Math.floor(ctx.measureText(this.text).ascent * 1.5);   // multiplying by 2 to fake a descent and leading
            h += i.top + i.bottom;

            return { height: h, width: w };
        },

        paint: function(ctx) {
            // paint the panel background
            this._super(ctx);

            var d = this.d();

            ctx.save();
            
            ctx.beginPath();
            ctx.rect(d.i.l, d.i.t, d.b.iw, d.b.ih);
            ctx.clip();
            
            ctx.translate(d.i.l + this.xOff, 0);

            var textMetrics = ctx.measureText(this.text);
            var y = d.i.t + textMetrics.ascent;
            if (th.browser.WebKit) y += 1;  // strings are one pixel too high in Safari 4 and Webkit nightly

            this.styleContext(ctx);
            var fill = ctx.fillStyle;

            if (this.focusManager.hasFocus(this)) {
                var selStartX = ctx.measureText(this.text.substring(0, this.selRelStart)).width - ( this.selRelStart != 0 ? 1 : 0);
                if (this.selStart == this.selEnd) {
                    if (this.isCursorVisible) {
                        ctx.fillRect(selStartX, d.i.t - 2, 1, y + 3)                
                    }
                } else {
                    ctx.fillStyle = this.cssValue('selection-color') || '#B5D2F3';
                    ctx.fillRect(selStartX, d.i.t - 2, ctx.measureText(this.text.substring(this.selRelStart, this.selRelEnd)).width, y + 3);                
                }                                
            }
                        
            ctx.fillStyle = fill;
            ctx.fillText(this.text, 0, y + 2);
            
            ctx.restore();
        }
    }
});

th.HtmlLabel = Class.define({
    type: "Label",

    superclass: th.Panel,

    members: {
        init: function(parms) {
            if (!parms) parms = {};

            this._super(parms);

            this.text = parms.text || "";
            this.lastText = '';
            this.parsedHtml = [];

            this.regTag = /#\w+|\w+/g;            
            this.regTags = /<(\w+|\w+\s+|#[a-fA-F0-9]{3}|#[a-fA-F0-9]{6})>|<\/(\w+|\w+\s|#[a-fA-F0-9]{3}|#[a-fA-F0-9]{6})>/g;
        },

        styleContext: function(ctx, style) {
            if (!ctx || !style) return;

            // we use the information within style to compute the canvas font-parameters!
            ctx.font = [style['font-weight'], style['font-style'], style['font-size'], style['font-family']].join(' ');
            ctx.fillStyle = style['color'];

            return ctx;
        },
        
        parseHtml: function() {
            if (this.lastText == this.text && this.parsedHtml.length != 0) return;
            
            // convert the cssValue('font') and cssValue('color') to the values for the styleArray
            var obj = { 'font-family': 'Tahoma', 'font-size': '9pt', 'font-style': '', 'font-weight': '', 'text-decoration': '', 'color': 'black'};

            // the array with all the styles of the current deep of the html-tree
            var styleArray = [ obj ];
            
            var values = th.getSpaceDelimitedItems(this.cssValue('font'));
            var fontFamily = [];
            for (var i = 0; i < values.length; i++) {
                if (th.isCssLength(values[i])) {
                    obj['font-size'] = values[i];
                } else {
                    switch (values[i]) {
                        case 'bold':
                            obj['font-weight'] = 'bold';
                            break;
                        case 'italic':
                            obj['font-style'] = 'italic';
                            break;
                        default:
                            fontFamily.push(values[i]);
                            break;
                    }
                }
            }
            obj['font-family'] = fontFamily.join(', ');
            obj['color'] = this.cssValue('color');
            
            // for the case, no text was set but the this.parsedHtml is empty => would conflict when calculating the sizes of the component => "save" the style
            if (this.lastText == this.text && this.parsedHtml.length == 0) {
                this.parsedHtml.push( { style: obj } );
                return;
            }
            
            var newStyle, tag, text = this.text;
            
            // array with all the tags like 'b', 'strong' corresponding to styleArray
            var tagArray = [ '' ];
            
            // the current position within the style Array (normaly the last item's index)
            var currentStylePos = 0;
            
            // the parsed html-text will go here
            this.parsedHtml = [];
            
            // get the tags from the htmlText
            var tags = this.text.match(this.regTags);
            
            if (tags != null) {
                // parse the text
                for (var i = 0; i < tags.length; i++) {
                    var end = text.indexOf(tags[i]);
                    this.parsedHtml.push( { style: styleArray[currentStylePos], text: text.substring(0, end) } );
                    text = text.substring(end + tags[i].length);
                
                    tag = tags[i].match(this.regTag)[0];
                    if (tags[i][1] != '/') {
                        // this is a open-tag: f.e.: <b>
                        newStyle = th.clone(styleArray[currentStylePos]);
                    
                        switch (tag) {
                            case 'b':
                            case 'strong':
                                newStyle['font-weight'] = 'bold';
                                break;
                            case 'i':
                                newStyle['font-style'] = 'italic';
                                break;
                            case 'u':
                                newStyle['text-decoration'] = 'underline';
                                break;
                            default:
                                if (tag[0] == '#') {
                                    // this is a color
                                    newStyle['color'] = tag;
                                } else {
                                    console.error("parseHtml: Can't parse the tag '" + tag + "' => !skip! parsing!");
                                    return;
                                }
                                break;
                        }
                        // save the newStyle
                        styleArray.push(newStyle);
                        tagArray.push(tag);
                        currentStylePos ++;
                    } else {
                        // this is a close-tag: f.e.: </b>
                        if (tagArray[currentStylePos] != tag) {
                            console.error("parseHtml: Close tag '" + tag + "' but should close '" + tagArray[currentStylePos] + "' => !skip! parsing!");
                            return;
                        }
                        styleArray.pop();
                        tagArray.pop();
                        currentStylePos --;
                    }
                }
            
                if (currentStylePos != 0) {
                    console.error("parseHtml: not all tag were closed again => !skip! parsing!");
                    return;
                }
            }            
            // add the last text
            this.parsedHtml.push( { style: styleArray[0], text: text } );
            this.shouldParse = false;
            this.lastText = this.text;
        },

        getPreferredSize: function() {
            this.parseHtml();
            var ctx = this.styleContext(this.parent.getScratchContext(), this.parsedHtml[0].style);
            var i = this.getInsets();

            // the +2 is to compensate for anti-aliasing on Windows, which isn't taken into account in measurements; this fudge factor should eventually become platform-specific
            var w = ctx.measureText(this.text).width + 2;
            w += i.left + i.right;

            var h = Math.floor(ctx.measureText(this.text).ascent * 1.5);   // multiplying by 2 to fake a descent and leading
            h += i.top + i.bottom;

            return { height: h, width: w };
        },

        paint: function(ctx) {
            // paint the panel background
            this._super(ctx);

            var d = this.d();

            if (this.text != this.lastText) this.parseHtml();
            // if something went wrong, don't continue!
            if (this.text != this.lastText) return;

            this.styleContext(ctx, this.parsedHtml[0].style);
            textMetrics = ctx.measureText('text');
            var y = d.i.t + textMetrics.ascent;
            if (th.browser.WebKit) y += 1;  // strings are one pixel too high in Safari 4 and Webkit nightly

            var width = 0;
            var maxWidth = (d.b.w - d.i.w);
            var textMetrics, textToRender, lastLength;
            var text, style;

            ctx.save();

            for (var i = 0; i < this.parsedHtml.length; i++) {
                text = this.parsedHtml[i].text;
                style = this.parsedHtml[i].style;
                
                if (text == '') continue;
                
                this.styleContext(ctx, style);
                textMetrics = ctx.measureText(text);
                
                if (width + textMetrics.width <= maxWidth) {
                    ctx.fillText(text, d.i.l + width, y);
                    if (style['text-decoration'] == 'underline') {
                        ctx.lineWidth = 1;
                        ctx.strokeStyle = style.color;
                        ctx.beginPath();
                        ctx.moveTo(d.i.l + width, y + 2.5);
                        ctx.lineTo(d.i.l + width + textMetrics.width, y + 2.5);
                        ctx.stroke();
                        ctx.closePath();
                    }
                    width += textMetrics.width;
                } else {
                    // got to truncate the text...
                    lastLength = text.length - 2;
                    textToRender = text;
                    while ((width + textMetrics.width > maxWidth) && lastLength > 0) {
                        textToRender = text.substring(0, --lastLength) + '...';
                        textMetrics = ctx.measureText(textToRender);
                    }
                    ctx.fillText(textToRender, d.i.l + width, y);
                    
                    break;
                }
            }
            
            ctx.restore();
        }
    }
});

// we should marry this with th.Button...
th.TextButton = Class.define({
    type: "TextButton",

    superclass: th.Label,

    members: {
        init: function(parms) {
            if (!parms) parms = {};
            this._super(parms);
                        
            this.clickFunction = parms.onclick;
            
            this.bus.bind("mousedown", this, this.onMouseDown, this);
            this.bus.bind("mouseup", this, this.onMouseUp, this);
        },
        
        onMouseDown: function(e) {
            this.pseudoClass = 'active';
            this.repaint();
        },

        onMouseUp: function(e) {
            delete this.pseudoClass;
            this.repaint();
            if (e.isOverMe) this.onClick();
        },

        onClick: function(e) {
            if (th.isFunction(this.clickFunction)) {
                this.clickFunction(e);
            } else if (th.isString(this.clickFunction)) {
                eval(this.clickFunction);
            }
        }
    },
});

th.ExpandingInfoPanel = Class.define({
    type: "ExpandingInfoPanel",

    superclass: th.Panel,

    members: {
        init: function(parms) {
            this._super(parms);
        },

        getMinimumRowHeight: function() {
            return 40;
        },

        getMinimumColumnWidth: function() {

        },

        layout: function() {
            if (this.children.length == 0) return;

            var d = this.d();


            var rows = Math.floor(Math.sqrt(this.children.length));
            var height = Math.floor(d.b.h / rows);
            while (height < this.getMinimumRowHeight() && rows > 1) {
                rows--;
                height = Math.floor(d.b.h / rows);
            }


            var perRow = Math.floor(this.children.length / rows);
            var remainder = this.children.length % rows;

            // TODO: verify a minimum height (and perhaps width)

            var currentChild = 0;
            var heightRemainder = d.b.h % rows;

            var currentY = 0;
            for (var i = 0; i < rows; i++) {
                var h = (i == rows - 1) ? height + heightRemainder : height;

                var cols = (remainder > 0) ? perRow + 1 : perRow;
                remainder--;

                var width = Math.floor(d.b.w / cols);
                var widthRemainder = d.b.w % cols;

                var currentX = 0;
                for (var z = 0; z < cols; z++) {
                    var w = (z == cols - 1) ? width + widthRemainder : width;
                    this.children[currentChild++].setBounds(currentX, currentY, w, h);
                    currentX += w;
                }
                currentY += h;
            }
        }
    }
});

th.List = Class.define({
    type: "List",

    superclass: th.Container,

    members: {
        init: function(parms) {
            if (!parms) parms = {};
            this._super(parms);
            
            this.items = parms.items || [];

            // TODO: I'm not sure where this came from, nor why on deselection no event is fired and no repaint occurs
            // leaving in for now
            this.allowDeselection = parms.allowDeselection || false;

            this.bus.bind("click", this, this.onmousedown, this);
            this.bus.bind("keydown", this, this.onkeydown, this);

            this.renderer = new th.Label();
            this.renderer.addCss("visibility", "hidden");    // prevent Th from rendering the label; we'll do it ourselves
            this.add(this.renderer);

            if (parms.topLabel) this.addTopLabel(parms.topLabel);
        },

        getPreferredSize: function() {
            return { width: 100,  // todo: calculate the actual preferred width
                     height: this.getRowHeight() * this.items.length + (this.label ? this.label.getPreferredSize().height : 0) };
        },

        performCopy: function() {
            if (!this.selected) return false;
            return this.getItemText(this.selected);
        },
        
        performCut: function() {
            if (!this.selected) return;
            var result = this.getItemText(this.selected);
            th.removeArrayItem(this.items, this.selected);
            delete this.selected;
            this.repaint();
            return result;
        },
        
        performPaste: function(text) {
            this.items.push(text);
            this.repaint();
        },

        addTopLabel: function(label) {
            this.label = label;
            this.label.className = "header";
            this.add(this.label);
        },

        onmousedown: function(e) {  
            if (this.focusManager !== undefined) {
                if (!this.focusManager.focus(this)) {
                    // in this case someone doesn't want the component to get focused...
                    th.stopEvent(e);
                    return;
                }
            }

            var item = this.getItemForPosition({ x: e.componentX, y: e.componentY });
            if (item != this.selected) {
                if (item) {
                    this.selected = item;
                    this.bus.fire("itemselected", { container: this, item: this.selected }, this);
                    this.render();
                } else if (this.allowDeselection)  {
                    delete this.selected;
                }
            }
            th.stopEvent(e);
        },
        
        onkeydown: function(e) {
            if (e.keyCode == 38/*key.UP_ARROW*/) {                
                this.moveSelectionUp();
                th.stopEvent(e);
            } else if (e.keyCode == 40/*key.DOWN_ARROW*/) {
                this.moveSelectionDown();
                th.stopEvent(e);
            }
        },

        selectItemByText: function(text) {
            if (this.items.length == 0) return false;
            var item = null;
            if (th.isObject(this.items[0])) {
                for (var x = 0; x < this.items.length; x++) {
                    if (this.getItemText(this.items[x]) == text) {
                        item = this.items[x];
                        break;
                    }
                }
                if (item == null)    return false;
            } else {
                if (this.items.indexOf(text) == -1)   return false;
                item = this.items[this.items.indexOf(text)];
            }

            if (this.selected != item) {
                this.selected = item;
                this.repaint();
            }

            return true;
        },

        moveSelectionUp: function() {
            if (!this.selected || this.items.length == 0) return;

            var x = 0;
            while (this.items[x] != this.selected) {
                x ++;
            }

            if (x != 0) {
                this.selected = this.items[x - 1];
                this.bus.fire("itemselected", { container: this, item: this.selected }, this);
                this.repaint();
            }
        },

        moveSelectionDown: function() {
            if (!this.selected && this.items.length == 0) return;
            if (!this.selected && this.items.length != 0) {
                var x = -1;
            } else {
                var x = 0;
                while (this.items[x] != this.selected) {
                    x ++;
                }            
            }

            if (x != this.items.length - 1) {
                this.selected = this.items[x + 1];
                this.bus.fire("itemselected", { container: this, item: this.selected }, this);
                this.repaint();
            }
        },

        getItemForPosition: function(pos) {
            pos.y += this.scrollTop;
            var y = this.getInsets().top;
            if (this.label) y += this.label.bounds.height;
            for (var i = 0; i < this.items.length; i++) {
                var h = this.heights[i];
                if (pos.y >= y && pos.y <= y + h) return this.items[i];
                y += h;
            }
        },

        getItemText: function(item) {
            if (item.text) return item.text;
            if (th.isString(item)) return item;
            return item.toString();
        },

        getRenderer: function(rctx) {
            this.renderer.text = this.getItemText(rctx.item);

            this.renderer.selected = rctx.selected;
            this.renderer.pseudoClass = (this.renderer.selected) ? "active" : undefined;
            this.renderer.item = rctx.item;
            this.renderer.className = rctx.even ? "even" : "odd";

            if (rctx.item.contents) this.renderer.className += "more";

            // resolve the CSS again to deal with odd/even stuff
            this.renderer.resolveCss();

            return this.renderer;
        },

        getRenderContext: function(item, row) {
            return { item: item, even: row % 2 == 0, selected: this.selected === item };
        },

        getRowHeight: function() {
            if (!this.rowHeight) {
                var d = this.d();
                var firstItem = (this.items.length > 0) ? this.items[0] : undefined;
                if (firstItem) {
                    var renderer = this.getRenderer(this.getRenderContext(firstItem, 0));

                    // commenting out this version until I work out how to make getPreferredHeight work better
                    // (i.e., not require you to check for its existence before invoking, which sucks) 
//                    this.rowHeight = renderer.getPreferredHeight(d.b.w - d.i.w);
                    this.rowHeight = renderer.getPreferredSize().height;
                }
            }
            return this.rowHeight || 0;
        },

        // neuter the built-in layout
        layout: function() {},

        paint: function(ctx) {
            var d = this.d();
            var paintHeight = Math.max(this.getPreferredSize().height, d.b.h);

            var y = d.i.t;
            if (this.label) {              
                var prefHeight = this.label.getPreferredSize().height;                    
                
                this.label.setBounds(d.i.l, y, d.b.w, prefHeight);

                this.label.paint(ctx);
                this.label.border.paint(ctx);

                y += prefHeight;
            }

            ctx.save();
            ctx.translate(-this.scrollLeft, -this.scrollTop);

            try {
                this.paintBackground(ctx, 0, y, d.b.w, paintHeight);

                if (this.items.length == 0) return;

                if (!this.renderer) {
                    console.log("No renderer for List of type " + this.type + " with id " + this.id + "; cannot paint contents");
                    return;
                }


                this.heights = [];
                var itemCounter = 0;
                while (y < paintHeight && itemCounter < this.items.length) {   // stop painting if current label is below the current viewing region
                    // we want to paint lines even in blank spaces, so if we are still in the viewing region
                    // and we've run out of items, we make up some blank ones
                    var useRealItem = (itemCounter < this.items.length);
                    var item = useRealItem ? this.items[itemCounter] : "";

                    var stamp = this.getRenderer(this.getRenderContext(item, itemCounter));
                    if (!stamp) break;

                    var w = d.b.w - d.i.w;
                    var h = (this.rowHeight) ? this.rowHeight :
                            (useRealItem) ? stamp.getPreferredSize().height : this.heights[this.heights.length - 1];
                    if (useRealItem) this.heights.push(h);

                    if ((y + h) >= this.scrollTop) {    // only paint the label if it isn't above the current viewing region
                        stamp.setBounds(0, 0, w, h);

                        ctx.save();
                        ctx.translate(d.i.l, y);
                        ctx.beginPath();
                        ctx.rect(0, 0, w, h);
                        ctx.closePath();
                        ctx.clip();

                        stamp.addCss("visibility", "visible");

                        stamp.paint(ctx);
                        stamp.border.paint(ctx);

                        stamp.addCss("visibility", "hidden");

                        ctx.restore();
                    }

                    itemCounter++;
                    y+= h;
                }
            } finally {
                ctx.restore();
            }
        }
    }
});

th.ScrollPane = Class.define({
    type: "ScrollPane",

    superclass: th.Panel,

    members: {
        init: function(parms) {
            if (!parms) parms = {};
            this._super(parms);

            this.hscroll = new th.HorizontalScrollbar();
            this.vscroll = new th.VerticalScrollbar();
            
            // if you click on the scroll buttons, make it scroll a little bit more then just 2 pixels
            this.hscroll.increment = 10;
            this.vscroll.increment = 10;

            this.bus.bind("scroll", this.hscroll, this.hscrolled, this);
            this.bus.bind("scroll", this.vscroll, this.vscrolled, this);

            // scrollpane supports using splitters instead of scrollbars; this component represents the component
            // that should be laid out in layout
            this.hscroll_c = this.hscroll;
            this.vscroll_c = this.vscroll;

            // add a splitter; for now only a vertical splitter is supported
            if (parms.splitter) {
                this.vsplitter = new th.VerticalSplitter({ scrollbar: this.vscroll });
                this.vscroll_c = this.vsplitter;

                this.bus.bind("dragstart", this.vsplitter, this.ondragstart, this);
                this.bus.bind("drag", this.vsplitter, this.ondrag, this);
                this.bus.bind("dragstop", this.vsplitter, this.ondragstop, this);
            }

            this.viewport = new th.Panel();
            this.topPanel = new th.Panel();
            this.viewport.layout = function() {}
            this.children = [ this.topPanel, this.viewport, this.hscroll_c, this.vscroll_c ];
            this.viewport.parent = this;
            this.topPanel.parent = this;
            this.hscroll_c.parent = this;
            this.vscroll_c.parent = this;

        },

        performScroll: function(e) {
            l = this.vscroll_c.scrollbar;
            this.vscroll_c.scrollbar.setValue(this.vscroll_c.scrollbar.value - e.delta * 100);
            th.stopEvent(e);
        },

        ondragstart: function(e) {
            if (this.preferredWidth == undefined) this.preferredWidth = this.bounds.width;
            this.startSize = this.preferredWidth;
        },

        ondrag: function(e) {
            var delta = e.currentPos.x - e.startPos.x;
            this.preferredWidth = this.startSize + delta;
            //this.parent.render();
            this.getScene().render();
        },

        ondragstop: function(e) {
            delete this.startSize;
        },

        hscrolled: function(e) {
            this.viewport.scrollLeft = e.value;
            this.render();
        },

        vscrolled: function(e) {
            this.viewport.scrollTop = e.value;
            this.render();
        },

        // scroll pane only supports one component; changing add to set the component as the view.
        // this kinda stinks; will revisit TODO
        add: function(component) {
            if (th.isArray(component)) component = component[0];
            this.view = component;
            this.viewport.add(this.view);
        },

        // see comment on add(); this only removes the passed component if it is the view
        remove: function(component) {
            if (this.view == component) {
                this.viewport.remove(component);
                this.view = undefined;
            }
        },

        getPreferredSize: function() {
            // check if there's a hard-coded preferred size; use it
            if (this.preferredWidth && this.preferredHeight) return { width: this.preferredWidth, height: this.preferredHeight };

            var pref;
            if (this.view) {
                // TODO: this should also include scrollbar dimensions if they are forced set to visible
                pref = this.view.getPreferredSize();
            } else {
                pref = this._super();
            }

            if (this.preferredWidth) pref.width = this.preferredWidth;
            if (this.preferredHeight) pref.height = this.preferredHeight;

            return pref;
        },

        layout: function() {
            // the component that we're going to scroll, called the "view"
            var component = this.view;

            // no component to display, so bail
            if (!component) return;

            // the dimensions of the overall scrollpane, of cos'
            var d = this.d();

            var topPanelHeight = 0;            
            if (this.topPanel.children.length != 0) {
                if (this.topPanel.cssValue("height")) {
                    topPanelHeight = th.convertAbsoluteUnitToPixels(this.topPanel.cssValue("height"));
                } else {
                    topPanelHeight = this.topPanel.getPreferredSize().height;                    
                }
            }

            // set the topPanels position
            this.topPanel.setBounds(d.i.l, d.i.t, d.b.iw, topPanelHeight);

            // set the viewport to take up all space in the scrollpane
            this.viewport.setBounds(d.i.l, d.i.t + topPanelHeight, d.b.iw, d.b.ih - topPanelHeight);

            // calculate the size of the view component; if scrolling is going on, it will be larger than the viewport,
            // but it should never be smaller
            var pref = component.getPreferredSize();
            var view_width = Math.max(pref.width, this.viewport.bounds.width);
            var view_height = Math.max(pref.height, this.viewport.bounds.height);

            // hang on; if the user has explicitly specified no scrolling in a dimension, we'll respect that
            var overflowX = this.cssValue("overflow-x") != "hidden";
            var overflowY = this.cssValue("overflow-y") != "hidden";
            if (!overflowX) view_width = this.viewport.bounds.width;
            if (!overflowY) view_height = this.viewport.bounds.height;

            // set the component size based on the calculations above
            component.setBounds(-this.viewport.scrollLeft, -this.viewport.scrollTop, view_width, view_height);

            // if both of the overflows are disabled, let's bail
            if (!overflowY && !overflowX) return;

            // short-cut reference
            var cb = component.bounds;                  // bounds of the view component
            var hp = this.hscroll_c.getPreferredSize(); // preferred size of the horizontal scroll component (scrollbar or splitter)
            var vp = this.vscroll_c.getPreferredSize(); // vertical of above

            // these track whether scrolling is needed in their respective dimension
            var hscroll = false;
            var vscroll = false;

            // check if we're not wide enough
            if ((cb.width > d.b.iw) && overflowX) hscroll = true;

            // check if we're not tall enough
            if ((cb.height > (d.b.ih - (hscroll ? hp.height : 0) - topPanelHeight)) && overflowY) vscroll = true;

            // recheck the width if we've added the vertical scroll bar (since we're now more narrow)
//            if (vscroll) {
//                if (cb.width > d.b.iw - vp.width) hscroll = true;
//            }

            // if we are in splitter mode, the hscroll_c component will be shown regardless of the scrollbar status
            var show_hscroll_c = (hscroll || this.hsplitter);

            // if we are in splitter mode, the hscroll_c component will be shown regardless of the scrollbar status
            var show_vscroll_c = (vscroll || this.vsplitter);

            if (show_hscroll_c) {
                this.hscroll_c.addCss("visibility", "visible");
                this.hscroll_c.setBounds(d.i.l, (d.i.t + d.b.ih) - hp.height + topPanelHeight, d.b.iw, hp.height - topPanelHeight);
                this.viewport.bounds.height -= this.hscroll_c.bounds.height;
                if (!show_vscroll_c) component.bounds.height -= this.hscroll_c.bounds.height;

                if (hscroll) {
                    this.hscroll.min = 0;
                    this.hscroll.max = cb.width - this.viewport.bounds.width;
                    this.hscroll.extent = this.hscroll.max / cb.width;
                    this.hscroll.addCss("visibility", "visible");
                } else {
                    this.hscroll.max = 0;
                    this.hscroll.addCss("visibility", "hidden");
                }
            } else {
                this.hscroll_c.addCss("visibility", "hidden");
            }

            if (show_vscroll_c) {
                this.vscroll_c.addCss("visibility", "visible");
                this.vscroll_c.setBounds((d.i.l + d.b.iw) - vp.width, d.i.t, vp.width, d.b.ih);
                this.topPanel.bounds.width -= this.vscroll_c.bounds.width;
                this.viewport.bounds.width -= this.vscroll_c.bounds.width;
                if (!show_hscroll_c) component.bounds.width -= this.vscroll_c.bounds.width;

                if (vscroll) {
                    this.vscroll.min = 0;
                    this.vscroll.max = cb.height - this.viewport.bounds.height;
                    this.vscroll.extent = this.vscroll.max / cb.height;
                    this.vscroll.addCss("visibility", "visible");
                } else {
                    this.vscroll.max = 0;
                    this.vscroll.addCss("visibility", "hidden");
                }
            } else {
                this.vscroll_c.addCss("visibility", "hidden");
            }

            if (hscroll && vscroll) {
                this.hscroll_c.bounds.width -= this.vscroll_c.bounds.width;
                //this.vscroll_c.bounds.height -= this.hscroll_c.bounds.height;
            } else {
                if (!hscroll) {
                    // reset the scrolLeft, if any
                    component.bounds.x = 0;
                    this.viewport.scrollLeft = 0;
                    this.hscroll.value = 0;
                }

                if (!vscroll) {
                    // reset the scrolLeft, if any
                    component.bounds.y = 0;
                    this.viewport.scrollTop = 0;
                    this.vscroll.value = 0;
                }
            }
        }
    }
});

th.HorizontalTree = Class.define({
    type: "HorizontalTree",

    superclass: th.Panel,

    members: {
        init: function(parms) {
            if (!parms) parms = {};
            this._super(parms);

            // create the scroll pane that will contain all of the lists
            this.scrollPane = new th.ScrollPane();
            this.add(this.scrollPane);

            // create the component that will be scrolled; this will contain the lists since scrollpane only works
            // with one component
            this.contents = new th.Panel();
            this.scrollPane.add(this.contents);

            // install a new getPreferredSize implementation that requests enough space to display all the nested lists
            var tree = this;
            this.contents.getPreferredSize = function() {
                var w = 0;
                var h = 0;

                var defaultWidth;
                
                var defaultListWidth = th.convertLengthToPixels(tree.cssValue("-th-list-width"), tree);

                th.forEach(tree.scrollPanes, function(scrollPane) {
                    if (!scrollPane.preferredWidth) {
                        if (defaultWidth == undefined) defaultWidth = defaultListWidth;
                        w += defaultWidth;
                    } else {
                        w += scrollPane.preferredWidth;
                    }

                    var temp_h = scrollPane.getPreferredSize().height;
                    if (temp_h > h) h = temp_h;
                });
                
                if (tree.details) {
                    w += defaultListWidth;
                }

                return { height: h, width: w };
            };

            // install a custom layout manager for the contents as well
            this.contents.layout = function() {
                var d = this.d();

                var x = d.i.l;
                for (var i = 0; i < tree.scrollPanes.length; i++) {
                    var scrollPane = tree.scrollPanes[i];

                    if (!scrollPane.preferredWidth) scrollPane.preferredWidth = th.convertLengthToPixels(tree.cssValue("-th-list-width"), tree);
                    scrollPane.setBounds(x, d.i.t, scrollPane.preferredWidth, d.b.h - d.i.h);

                    x += scrollPane.bounds.width;
                }

                if (tree.details) {
                    tree.details.setBounds(x, d.i.t, th.convertLengthToPixels(tree.cssValue("-th-list-width"), tree), d.b.h - d.i.h);
                }
            }

            // the name of this component makes the orientation explicit, but just in case there's any confusion...
            this.orientation = th.HORIZONTAL;

            // the array that will contain the scrollpanes that contain the lists for each level of hierarchy
            this.scrollPanes = [];
        },

        // Set the initial data for the HorizontalTree. The argument should be an array of objects, each of which
        // may contain a property "contents" that is either a function or an array. If it is a function, it will be
        // invoked with two arguments: the current path, and a reference to this tree. If it is an array, it will be
        // displayed in another list. See the docs for an explanation of how the items are displayed in the lists.
        setData: function(data) {
            // remove all the current scroll panes and any listeners associated with them
            for (var i = 0; i < this.scrollPanes.length; i++) {
                this.contents.remove(this.scrollPanes[i]);
                if (this.scrollPanes[i].view) this.bus.unbind(this.scrollPanes[i].view);
            }
            this.scrollPanes = [];

            this.data = data;
            this.showChildren(null, data);
        },

        updateData: function(parent, contents) {
            parent.contents = contents;
            if (this.getSelectedItem() == parent) {
                this.showChildren(parent, parent.contents);
            }
        },

        replaceList: function(index, contents) {
            this.scrollPanes[index].view.items = contents;
            delete this.scrollPanes[index].view.selected;
            this.render();
        },

        removeListsFrom: function(index) {
            for (var x = index; x < this.scrollPanes.length; x++) {
                this.bus.unbind(this.scrollPanes[x].view);
                this.remove(this.scrollPanes[x]);
            }

            this.scrollPanes = this.scrollPanes.slice(0, index);
            this.getScene().render();
        },

        showChildren: function(newItem, children) {
            // remove the details pane if it is showing
            if (this.details) {
                this.contents.remove(this.details);
                delete this.details;
            }

            // if the "children" argument isn't an array, assume it's a function that will load the children
            if (!th.isArray(children)) {
                children(this.getSelectedPath(), this);

                // re-render before we bail in case the details pane was already showing
                this.render();

                // bailing because the children function should callback when it has retrieved the data
                return;
            }

            // if the children array is empty, there's nothing to do
            if (!children || children.length == 0) return;

            // create a slightly customized List to contain the children
            var list = this.createList(children);

            // create an id; I think this is just for debugging purposes
            if (this.id) list.id = this.id + "-list-" + (this.scrollPanes.length + 1);

            // add a listener to respond when an item has been selected in the list
            this.bus.bind("itemselected", list, this.itemSelected, this);
            
            // add a listener to respond when an onContextMenu event was fired within the list
            this.bus.bind("contextmenu", list, this.onContextMenu, this);

            // add a listener to propagate a double-click event in the list to the tree; not sure why
            var tree = this;
            this.bus.bind("dblclick", list, function(e) {
                tree.bus.fire("dblclick", e, tree);
            });

            // create a scrollpane wrapper around the list
            var scrollPane = new th.ScrollPane({ splitter: true });
            scrollPane.add(list);

            this.scrollPanes.push(scrollPane);
            this.contents.add(scrollPane);

            // not sure why the this.parent is required here; shouldn't be
            if (this.parent) this.render();

            // if the horizontal scrollbar is visible, move it all the way to the right
            if (this.scrollPane.hscroll.max != 0) {
                this.scrollPane.hscroll.setValue(this.scrollPane.hscroll.max);
            }
        },
        
        onContextMenu: function(e) {
            for (var i = 0; i < this.scrollPanes.length; i++) {
                if (this.scrollPanes[i].view === e.thComponent) {
                    this.bus.fire("contextmenu", { e: e, index: i}, this);
                    break;
                }
            }
        },

        showDetails: function(item) {
            if (this.details) this.contents.remove(this.details);

            if (!this.getDetailPanel) {
                return;
            }
            
            var panel = this.getDetailPanel(item);
            this.details = panel;
            this.contents.add(this.details);
           
            // not sure why the this.parent is required here; shouldn't be
            if (this.parent) this.render();
            
            // if the horizontal scrollbar is visible, move it all the way to the right
            if (this.scrollPane.hscroll.max != 0) {
                this.scrollPane.hscroll.setValue(this.scrollPane.hscroll.max);
            }
        },
        
        createList: function(items) {
            var list = new th.List({ items: items });

            var oldGetItemText = list.getItemText;
            var tree = this;
            list.getItemText = function(item) {
                if (tree.getItemText) {
                    return tree.getItemText(item);
                } else {
                    return oldGetItemText(item);
                }
            }

            return list;
        },

        getSelectedItem: function() {
            var selected = this.getSelectedPath();
            if (selected.length > 0) return selected[selected.length - 1];
        },

        getSelectedPath: function(asString) {
            asString = asString || false;
            var path = [];

            var i;

            for (i = 0; i < this.scrollPanes.length; i++) {
                if (this.scrollPanes[i].view.selected) {
                    path.push(this.scrollPanes[i].view.selected);
                } else {
                    break;
                }
            }

            if (path.length == 0) return;

            if (asString) {
                var result = '';
                for (i = 0; i < path.length - 1; i++) {
                    result += this.getItemText(path[i]) + '/';
                }
                if (!path[path.length - 1].contents) {
                    result += this.getItemText(path[path.length - 1])
                } else {
                    result += this.getItemText(path[path.length - 1]) + '/';
                }

                return result;
            } else {
                return path;
            }
        },

        itemSelected: function(e) {
            var list = e.thComponent;

            // add check to ensure that list has an item selected; otherwise, bail
            if (!list.selected) return;

            var path = [];
            var selectionIndex = 0;

            for (var i = 0; i < this.scrollPanes.length; i++) {
                path.push(this.scrollPanes[i].view.selected);
                if (this.scrollPanes[i].view == list) {
                    selectionIndex = i;
                    for (var j = i + 1; j < this.scrollPanes.length && this.scrollPanes[j].view.selected; j++) {
                        // saves the last selected item if the user want's to get back to this tree via arrows again
                        if (this.scrollPanes[j - 1].view.selected) {
                            this.scrollPanes[j - 1].view.selected.lastSelected = this.scrollPanes[j].view.selected.name
                        }
                        delete this.scrollPanes[j].view.selected;
                    }
                    break;
                }
            }

            // fire the event AFTER some items maybe got deselected
            this.bus.fire('itemselected', {e: e, index: selectionIndex}, this);

            if (path.length < this.scrollPanes.length) {
                // user selected an item in a previous list; must ditch the subsequent lists
                var newlists = this.scrollPanes.slice(0, path.length);
                for (var z = path.length; z < this.scrollPanes.length; z++) {
                    this.contents.remove(this.scrollPanes[z]);
                    this.bus.unbind(this.scrollPanes[z].view);
                }
                this.scrollPanes = newlists;
                this.getScene().render();
            }

            // determine whether to display new list of children or details of selection
            var newItem = path[path.length - 1];
            if (newItem && newItem.contents) {
                this.showChildren(newItem, newItem.contents);
            } else {
                this.showDetails(newItem);
            }
        },

        getItem: function(pathToItem) {
            var items = this.data;
            var item;
            for (var i = 0; i < pathToItem.length; i++) {
                for (var z = 0; z < items.length; z++) {
                    if (items[z] == pathToItem[i]) {
                        item = items[z];
                        items = item.contents;
                        break;
                    }
                }
            }
            return item;
        },
        
        getList: function(index) {
            var sp = this.scrollPanes[index];
            if (sp != undefined) {
                return sp.view;
            } else {
                return undefined;
            }
        },
        
        getListCount: function() {
            return this.scrollPanes.length;
        },

        layout: function() {
            var d = this.d();
            this.scrollPane.setBounds(d.i.l, d.i.t, d.b.iw, d.b.ih);
        },

        paintSelf: function(ctx) {
            this._super(ctx);
        }
    }
});