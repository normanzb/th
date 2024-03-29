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

th.CssParser = Class.define({
    members: {
        // parses the passed stylesheet into an object with properties containing objects with the attribute names and values
        parse: function(str, ret) {
            if (!ret) ret = {};

            // kill any extra whitespace in the passed in stylesheet
            str = str.replace(/\s+/gi, " ");

            th.forEach(this.munge(str, false).split('`b%'), function(css){
                css = css.split('%b`'); // css[0] is the selector; css[1] is the index in munged for the cssText
                if (css.length < 2) return; // invalid css
                css[0] = this.restore(css[0]);
                var obj = ret[css[0]] || {};
                ret[css[0]] = th.mixin(obj, this.parsedeclarations(css[1]));
            }, this);

            return ret;
        },

        // replace strings and brace-surrounded blocks with %s`number`s% and %b`number`b%. By successively taking out the innermost
        // blocks, we ensure that we're matching braces. No way to do this with just regular expressions. Obviously, this assumes no one
        // would use %s` in the real world.
        // Turns out this is similar to the method that Dean Edwards used for his CSS parser in IE7.js (http://code.google.com/p/ie7-js/)
        REbraces: /{[^{}]*}/,

        REfull: /\[[^\[\]]*\]|{[^{}]*}|\([^()]*\)|function(\s+\w+)?(\s*%b`\d+`b%){2}/, // match pairs of parentheses, brackets, and braces and function definitions.

        REatcomment: /\/\*@((?:[^\*]|\*[^\/])*)\*\//g, // comments of the form /*@ text */ have text parsed
        // we have to combine the comments and the strings because comments can contain string delimiters and strings can contain comment delimiters
        // var REcomment = /\/\*(?:[^\*]|\*[^\/])*\*\/|<!--|-->/g; // other comments are stripped. (this is a simplification of real SGML comments (see http://htmlhelp.com/reference/wilbur/misc/comment.html) , but it's what real browsers use)
        // var REstring = /\\.|"(?:[^\\\"]|\\.|\\\n)*"|'(?:[^\\\']|\\.|\\\n)*'/g; // match escaped characters and strings

        REcomment_string:
          /(?:\/\*(?:[^\*]|\*[^\/])*\*\/)|(\\.|"(?:[^\\\"]|\\.|\\\n)*"|'(?:[^\\\']|\\.|\\\n)*')/g,

        REmunged: /%\w`(\d+)`\w%/,

        uid: 0, // unique id number

        munged: {}, // strings that were removed by the parser so they don't mess up searching for specific characters

        munge: function(str, full) {
            var self = this;
            str = str
                .replace(this.REatcomment, '$1') // strip /*@ comments but leave the text (to let invalid CSS through)
                .replace(this.REcomment_string, function(s, string) { // strip strings and escaped characters, leaving munged markers, and strip comments
                    if (!string) return '';
                    var replacement = '%s`'+(++self.uid)+'`s%';
                    self.munged[self.uid] = string.replace(/^\\/, ''); // strip the backslash now
                    return replacement;
                });

            // need a loop here rather than .replace since we need to replace nested braces
            var RE = full ? this.REfull : this.REbraces;
            while (match = RE.exec(str)) {
                replacement = '%b`'+(++this.uid)+'`b%';
                this.munged[this.uid] = match[0];
                str = str.replace(RE, replacement);
            }
            return str;
        },

        restore: function(str) {
            if (str === undefined) return str;
            while (match = this.REmunged.exec(str)) {
                str = str.replace(this.REmunged, this.munged[match[1]]);
            }
            return th.trim(str);
        },

        parsedeclarations: function(index){ // take a string from the munged array and parse it into an object of property: value pairs
            var str = this.munged[index].replace(/(?:^\s*[{'"]\s*)|(?:\s*([^\\])[}'"]\s*$)/g, '$1'); // find the string and remove the surrounding braces or quotes
            str = this.munge(str); // make sure any internal braces or strings are escaped
            var parsed = {};
            th.forEach(str.split(';'), function(decl) {
                decl = decl.split(':');
                if (decl.length < 2) return;
                parsed[this.restore(decl[0])] = this.restore(decl[1]);
            }, this);
            return parsed;
        }
    }
});

th.CssExpander = Class.define({
    members: {
        init: function() {
            this.expandRules = {
                'border': this.expandBorder,
                'border-top': this.expandBorderSide,
                'border-left': this.expandBorderSide,
                'border-right': this.expandBorderSide,
                'border-bottom': this.expandBorderSide,
                'border-width': this.expandBorderWidth,
                'border-image': this.expandBorderImage,
                'margin': this.expandMarginOrPadding,
                'padding': this.expandMarginOrPadding,
                'overflow': this.expandOverflow
            };
        },
        
        expand: function(property, value, proplist) {
            if (!proplist) proplist = {};
            if (this.expandRules[property]) {
                this.expandRules[property].apply(this, [ property, value, proplist ]);
            } else {
                proplist[property] = value;
            }
            return proplist;
        },

        saveProperty: function(property, value, propertyList) {
            // hmm... I *think* this is supposed to be a sort of CSS sanity check to catch valid CSS values that we don't
            // presently support, but not quite sure
            if (th.getSpaceDelimitedItems(value).length != 1 && property != 'font' && property != '-th-grid-cols' && property != '-th-grid-rows') {
                console.error("th.CssExpander: Can't expand '" + property + "' with value '" + value + "'!");
            }
            propertyList[property] = value;
        },
        
        expandBorderWidth: function(property, value, propertyList) {
            this.expandSideNumbers("border-", "-width", value, propertyList);
        },

        expandOverflow: function(property, value, propertyList) {
            this.saveProperty("overflow-x", value, propertyList);
            this.saveProperty("overflow-y", value, propertyList);
        },

        expandMarginOrPadding: function(property, value, propertyList) {
            this.expandSideNumbers(property + '-', '', value, propertyList);
        },
        
        expandSideNumbers: function(propertyPref, propertySuf, value, propertyList) {
            var values = value.split(" ");
            if (values.length == 3) values = [ values[0], values[1], values[2], values[1] ];
            if (values.length == 2) values = [ values[0], values[1], values[0], values[1] ];
            if (values.length == 1) values = [ values[0], values[0], values[0], values[0] ];

            if (values.length >= 4) {  // top right bottom left
                this.saveProperty(propertyPref + "top"    + propertySuf, values[0], propertyList);
                this.saveProperty(propertyPref + "right"  + propertySuf, values[1], propertyList);
                this.saveProperty(propertyPref + "bottom" + propertySuf, values[2], propertyList);
                this.saveProperty(propertyPref + "left"   + propertySuf, values[3], propertyList);
            }
        },
        
        expandBorder: function(property, value, propertyList) {
            this.expandBorderSide("border-top", value, propertyList);
            this.expandBorderSide("border-right", value, propertyList);
            this.expandBorderSide("border-bottom", value, propertyList);
            this.expandBorderSide("border-left", value, propertyList);
        },
        
        expandBorderSide: function(property, value, propertyList) {
             var values = th.getSpaceDelimitedItems(value);
             for (var i = 0; i < values.length; i++) {
                 if (th.isCssLength(values[i])) {
                     // length
                     this.saveProperty(property + "-width", values[i], propertyList);
                 } else if (th.isCssBorderStyle(values[i])) {
                     // border style
                     this.saveProperty(property + "-style", values[i], propertyList);
                 } else {
                     // border color
                     this.saveProperty(property + "-color", values[i], propertyList);
                 }
             }
        },
        
        expandBorderImage: function(property, value, propertyList) {
            var values = th.getSpaceDelimitedItems(value);
            var propertyExpanded = ['url', 'top', 'right', 'bottom', 'left', 'repeat-x', 'repeat-y'];
            
            for (var i = 0; i < propertyExpanded.length; i++) {
                this.saveProperty('border-image-' + propertyExpanded[i], values[i], propertyList);
            }
        }
    }
});

th._cssExpander = new th.CssExpander();
th.expandCssProperty = function(cssProperty, cssValue, destination) {
    return th._cssExpander.expand(cssProperty, cssValue, destination);
}