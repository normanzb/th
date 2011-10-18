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

//= require "jstraits"

// ** {{{ Utils }}} **
//
// A bunch of misc. functions used throughout Th. Many of these are ripped from popular Ajax frameworks; a comment indicates
// the provenance of such functions

// prevent errors on console-less browsers
if (!("console" in window)) {
    window.console = {
        log: function(s) {
            // foo
        }
    }
}

// this allows us to deal with file URLs and XHR when working with Firefox
if (location.href.indexOf("file:") == 0) {
    try {
       if (netscape.security.PrivilegeManager.enablePrivilege) {
           netscape.security.PrivilegeManager.enablePrivilege('UniversalBrowserRead');
       }
    } catch (ex) {
        console.log("Couldn't elevate priviledges to deal with file URLs");
    }
}

if (typeof th == "undefined") th = {};

// copied from Prototype 1.6.0.2
th.browser = {
  IE:     !!(window.attachEvent && !window.opera),
  Opera:  !!window.opera,
  WebKit: navigator.userAgent.indexOf('AppleWebKit/') > -1,
  Gecko:  navigator.userAgent.indexOf('Gecko') > -1 && navigator.userAgent.indexOf('KHTML') == -1,
  MobileSafari: !!navigator.userAgent.match(/Apple.*Mobile.*Safari/)
}

// = isMac =
//
// I hate doing this, but we need some way to determine if the user is on a Mac
// The reason is that users have different expectations of their key combinations.
//
// Take copy as an example, Mac people expect to use CMD or APPLE + C
// Windows folks expect to use CTRL + C
th.isMac = function() {
    return navigator.appVersion.indexOf("Macintosh") >= 0;
};

// * Upgrade Firefox 3.0.x text rendering to HTML 5 standard
th.fixCanvas = function(ctx) {
    if (!ctx.fillText && ctx.mozDrawText) {
        ctx.fillText = function(textToDraw, x, y, maxWidth) {
            ctx.translate(x, y);
            ctx.mozTextStyle = ctx.font;
            ctx.mozDrawText(textToDraw);
            ctx.translate(-x, -y);
        }
    }

    // * Setup measureText
    if (!ctx.measureText && ctx.mozMeasureText) {
        ctx.measureText = function(text) {
            if (ctx.font) ctx.mozTextStyle = ctx.font;
            var width = ctx.mozMeasureText(text);
            return { width: width };
        }
    }

    // * Setup html5MeasureText
    if (ctx.measureText && !ctx.html5MeasureText) {
        ctx.html5MeasureText = ctx.measureText;
        ctx.measureText = function(text) {
            var textMetrics = ctx.html5MeasureText(text);

            // fake it 'til you make it
            textMetrics.ascent = ctx.html5MeasureText("m").width;

            return textMetrics;
        }
    }

    // * for other browsers, no-op away
    if (!ctx.fillText) {
        ctx.fillText = function() {}
    }

    if (!ctx.measureText) {
        ctx.measureText = function() { return 10; }
    }

    return ctx;
}

th.byId = function(id) {
    return document.getElementById(id);
}

// copied from Dojo 1.3 beta something or other
th.isString = function(it) {
	return !!arguments.length && it != null && (typeof it == "string" || it instanceof String); // Boolean
}

// copied from Dojo 1.3 beta something or other
th.isArray = function(it) {
	return it && (it instanceof Array || typeof it == "array"); // Boolean
}

// copied from Dojo 1.3 beta something or other
th.forEach = function(arr, callback, thisObject) {
    // match the behavior of the built-in forEach WRT empty arrs
    if (!arr || !arr.length){ return; }

    // FIXME: there are several ways of handilng thisObject. Is
    // dojo.global always the default context?
    var _p = th._getParts(arr, thisObject, callback); arr = _p[0];
    for (var i = 0, l = arr.length; i < l; ++i) {
        _p[2].call(_p[1], arr[i], i, arr);
    }
}

// copied from Dojo 1.3 beta something or other
th._getParts = function(arr, obj, cb){
    return [
        th.isString(arr) ? arr.split("") : arr,
        obj || this,
        // FIXME: cache the anonymous functions we create here?
        th.isString(cb) ? new Function("item", "index", "array", cb) : cb
    ];
};

th.xhrGet = function(args) {
    var xhr = new XMLHttpRequest();
    xhr.onreadystatechange = function() {
        if (xhr.readyState == 4) {
            args.load.apply(args.context, [ xhr.responseText ]);
        }
    };
    xhr.open("GET", args.url);
    xhr.send(null);
}

th.remove = function(array, toRemove) {
    var newarr = [];
    for (var i = 0; i < array.length; i++) {
        if (array[i] != toRemove) newarr.push(array[i]);
    }
    return newarr;
}

th.observe = function(source, eventName, listener, context) {
    var toInvoke = (context) ? function(e) { listener.apply(context, [e]) } : listener;
    var oldEventFunction = source["on" + eventName];

    if (typeof oldEventFunction == "function") {
        source["on" + eventName] = function(e) {
            if (oldEventFunction) {
                oldEventFunction(e);
            }
            toInvoke(e);
        }
    } else {
        source["on" + eventName] = toInvoke;
    }
}

// copied from Dojo 1.3 beta something or other
th.trim = String.prototype.trim ?
	function(str){ if (str == undefined) return str; return str.trim(); } :
	function(str){ if (str == undefined) return str; return str.replace(/^\s\s*/, '').replace(/\s\s*$/, ''); };

// copied from Dojo 1.3 beta something or other
th.mixin = function(obj, props) {
    if (!obj) { obj = {}; }
    for(var i = 1, l = arguments.length; i < l; i++){
        th._mixin(obj, arguments[i]);
    }
    return obj;
}

// copied from Dojo 1.3 beta something or other
th._mixin_tobj = {};
th._mixin = function(obj, props) {
    for (var x in props) {
        if (th._mixin_tobj[x] === undefined || th._mixin_tobj[x] != props[x]) {
            obj[x] = props[x];
        }
    }

    if (th.browser.IE && props) {
        var p = props.toString;
        if (typeof p == "function" && p != obj.toString && p != th._mixin_tobj.toString &&
                p != "\nfunction toString() {\n    [native code]\n}\n"){
            obj.toString = props.toString;
        }
    }

    return obj;
}

// copied from Prototype 1.6.0.2
th.cumulativeOffset = function(element) {
    var valueT = 0, valueL = 0;
    do {
        valueT += element.offsetTop  || 0;
        valueL += element.offsetLeft || 0;
        element = element.offsetParent;
    } while (element);
    return th._returnOffset(valueL, valueT);
}

// copied from Prototype 1.6.0.2
th._returnOffset = function(l, t) {
    var result = [l, t];
    result.left = l;
    result.top = t;
    return result;
};

th.isPercentage = function(str) {
    // TODO: make more robust
    return (str.indexOf && str.indexOf("%") != -1);
};

th.isCssPixel = function(str) {
    str = th.trim(str).toLowerCase();
    return (str.indexOf("px") == str.length - 2);
};

th.isCssLength = function(str) {
    if (str === undefined) return false;
    if (str == 0) return true;

    // resource: http://www.w3.org/TR/CSS21/syndata.html#length-units
    return /^[\d\.]+(em|ex|px|\%|in|cm|mm|pt|pc)$/.test(str);
};

th.isCssBorderStyle = function(str) {
    // resource: http://www.w3schools.com/css/pr_border-style.asp
    return /^(none|hidden|dotted|dashed|solid|double|groove|ridge|inset|outset)$/.test(str);
};

// a version of split that looks for comma-delimited chunks and ignores any commas that occur in parens
th.getSpaceDelimitedItems = function(input) {
    return th.parenAwareSplit(" ", input);
}

th.getCommaDelimitedItems = function(input) {
    return th.parenAwareSplit(",", input);
}

th.lastArrayItem = function(arr) {
    return arr[arr.length - 1];
}

th.removeArrayItem = function(arr, item) {
    return arr.splice(arr.indexOf(item), 1);
}

th.stopEvent = function(e) {
    e.preventDefault();
    e.stopPropagation();
}

th.getSceneById = function(id) {
    for (var x = 0; x < th.global_scene_array.length; x++) {
        if (th.global_scene_array[x].id == id) return th.global_scene_array[x];
    }
}

// a version of split that looks for delimited chunks and ignores any that occur in parens
th.parenAwareSplit = function(delim, input) {
    if (delim.length != 1) throw "Invalid delimiter passed to parenAwareSplit: '" + delim + "'";

    var pieces = [];
    var inParens = 0;
    var currentCharacter;
    var currentPiece = "";

    for (var x = 0; x < input.length; x++) {
       currentCharacter = input[x];

       if (currentCharacter == delim) {
           if (!inParens) {
               pieces.push(th.trim(currentPiece));
               currentPiece = "";
               continue;
           }
       } else if (currentCharacter == '(') {
           inParens++;
       } else if (currentCharacter == ')') {
           inParens--;
       }
       currentPiece += currentCharacter;
    }

    pieces.push(th.trim(currentPiece)); // get the last piece too

    return pieces;
}

th.whitespace = " \t\n\r";
th.isWhitespace = function(str) {
    // Is s empty?
    if (!str || str.length == 0) return true;

    // Search through string's characters one by one
    // until we find a non-whitespace character.
    // When we do, return false; if we don't, return true.
    for (var i = 0; i < str.length; i++) {
        // Check that current character isn't whitespace.
        var c = str.charAt(i);

        if (th.whitespace.indexOf(c) == -1) return false;
    }

    // All characters are whitespace.
    return true;
}

// = leadingWhitespace =
//
// Given a row, extract a copy of the leading spaces or tabs.
// E.g. an array with the string "\t    \taposjd" would return an array with the
// string "\t    \t".
//
// {{row}} - The row to hunt through
th.leadingWhitespace = function (row) {
    var leading = [];
    for (var i = 0; i < row.length; i++) {
        if (row[i] == ' ' || row[i] == '\t' || row[i] == '' || row[i] === undefined) {
            leading.push(row[i]);
        } else {
            return leading;
        }
    }
    return leading;
}

th.measureUsingDOM = function(measuringFunction, context) {
    if (!document) throw "Can't perform measurements outside of browser";

    var body = document.getElementsByTagName("body")[0];
    var divvy = document.createElement("div");
    divvy.setAttribute("style", "position: absolute; visibility:hidden");
    body.appendChild(divvy);

    if (context) {
        measuringFunction.apply(context, [ divvy ]);
    } else {
        measuringFunction(divvy);
    }

    body.removeChild(divvy);
}

th.measure_cache = {};   // speculative cache, haven't measured to see if it's useful

// if value is undefined, returns def
th.safeget = function(value, def) {
    return (value == undefined) ? def : value;
}

th.unitRegex = /^([\d\.]+)(em|ex|px|\%|in|cm|mm|pt|pc)$/;
th.absoluteUnitRegex = /^([\d\.]+)(px|in|cm|mm|pt|pc)$/;

th.isBorderLength = function(length) {
    return (length == "thin" || length == "medium" || length == "thick");
}

th.convertLengthToPixels = function(length, component) {
    if (length == 0) return 0;

    if (th.isBorderLength(length)) {
        return th.convertBorderLengthToPixels(length);
    } else if (th.absoluteUnitRegex.test(length)) {
        return th.convertAbsoluteUnitToPixels(length);
    }
}

th.convertBorderLengthToPixels = function(length) {
    if (length === undefined) return 0;

    var cacheKey = length;
    if (th.measure_cache[cacheKey] !== undefined) return th.measure_cache[cacheKey];

    var result = undefined;
    th.measureUsingDOM(function(div) {
        div.setAttribute("style", "position: relative; border-left: " + length + " solid black");
        div.innerHTML = "some text";
        result = div.scrollWidth - div.clientWidth;
    });

    th.measure_cache[cacheKey] = result;
    return result;
}

th.convertAbsoluteUnitToPixels = function(lengthStr, length) {
    var unit;
    if (length === undefined) {
        var results = th.absoluteUnitRegex.exec(lengthStr);
        if (results.length != 3) throw "Passed length " + lengthStr + " isn't a CSS absolute unit";
        unit = results[2];
        length = Number(results[1]);
    } else {
        unit = lengthStr;
    }

    if (unit == "px") {
        return length;
    } else if (unit == "in" || unit == "cm" || unit == "mm" || unit == "pt" || unit == "pc") {
        return th.measureAbsoluteUnit(length + unit);
    } else {
        throw "Unsupported unit: " + unit;
    }
}

// used by th.convertAbsoluteUnitToPixels, but you could invoke directly I guess
th.measureAbsoluteUnit = function(measurement) {
    if (measurement === undefined) return 0;
    
    var cacheKey = measurement;
    if (th.measure_cache[cacheKey]) return th.measure_cache[cacheKey];

    var result = undefined;
    th.measureUsingDOM(function(div) {
        var style = div.getAttribute("style");
        div.setAttribute("style", style += "; width: " + measurement);
        result = div.scrollWidth;
    });
    th.measure_cache[cacheKey] = result;
    return result;
}

th.convertEmToPixels = function(fontStyle, length) {
    var cacheKey = fontStyle + length;
    if (th.measure_cache[cacheKey]) return th.measure_cache[cacheKey];
    var result = undefined;
    th.measureUsingDOM(function(div) {
        var style = div.getAttribute("style");
        div.setAttribute("style", style += "; font: " + fontStyle + "; width: " + length + "em");
        result = div.scrollWidth;
    });
    th.measure_cache[cacheKey] = result;
    return result;
}

th.getHierarchyString = function(component) {
    var hierarchy = "";
    while (component) {
        var compy = component.type;
        if (component.id) compy += "#" + component.id;
        if (component.className) compy += "." + component.className;
        hierarchy = compy += " " + hierarchy;
        component = component.parent;
    }
    return th.trim(hierarchy);
}

// copied from Dojo 1.3 beta something or other
th.isObject = function(/*anything*/ it){
	// summary:
	//		Returns true if it is a JavaScript object (or an Array, a Function
	//		or null)
	return it !== undefined &&
		(it === null || typeof it == "object" || th.isArray(it) || th.isFunction(it)); // Boolean
}

// copied from Dojo 1.3 beta something or other
th.isFunction = (function(){
	var _isFunction = function(/*anything*/ it){
		return it && (typeof it == "function" || it instanceof Function); // Boolean
	};

    // commenting out because we don't have a way to distinguish between Safari and WebKit at the moment
//	return th.browser.WebKit ?
//		// only slow this down w/ gratuitious casting in Safari (not WebKit)
//		function(/*anything*/ it){
//			if(typeof it == "function" && it == "[object NodeList]"){ return false; }
//			return _isFunction(it); // Boolean
//		} : _isFunction;
    return _isFunction;
})();

th.hitch = function(source, func) {
    return function() { 
        if (arguments.length == 0) { 
            func.apply(source);
        } else {
            func.apply(source, arguments);
        } 
    };
}

th.delay = function(func, delay, source) {
    if (source) func = th.hitch(source, func);
    return setTimeout(func, delay);
}

th.clone = function (o) {
    // shallow clone, just copies properties
    var oo;
    var c;
    if (typeof o == "number" || typeof o == "string") {
        return o;
    }

    if (o instanceof Object) {
        oo = {};
        for (var key in o) {
            c = this.clone(o[key]);
            if (c !== undefined) oo[key] = c;
        }
        return oo;
    }

    if (o instanceof Array) {
        oo = [];
        for (var i; i < o.length; i) {
            c = this.clone(o[i]);
            if (c !== undefined) oo[i] = c;
        }

        return oo;
    }
};
