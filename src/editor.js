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

th.Settings = new (Class.define({
    members: {
        init: function () {
            this.settings = {
                tabSize: 4,
                strictlines: true,
                smartmove: true
            };
        },

        get: function (key) {
            return this.settings[key];
        },

        isSettingOn: function (key) {
            var value = this.settings[key];
            return (value === true) || (value === 'on') || (value === 'enable');
        }
    }
}));

if (typeof th.Editor == "undefined") th.Editor = {};

th.Editor.Template = Class.define({
    type: "Editor::Template",

    superclass: th.Panel,

    uses: [
        th.KeyHelpers
    ],

    members: {
        init: function (params) {
            this._super(params);
            this.model = new th.Editor.Model(this);
            this.cursor = new th.Editor.Cursor(this);
            this.actions = new th.Editor.Actions(this);
            
            this.vscroll = new th.VerticalScrollbar();
            this.add(this.vscroll);

            this.leftPadding = 0;
            this.rightPadding = 0;
            this.scrollTop = 0;
            
            this.bus.bind("scroll", this.vscroll, this.vscrolled, this);

            this.bus.bind("editor:model:changed", this, this.onModelChange, this);
            this.bus.bind("editor:cursor:moved", this, this.onCursorMove, this);

            this.bus.bind("keypress", this, this.onKeyPress, this);

            // TODO: bind all the keys!
            this.key.bind("", this.key.ARROW_RIGHT, this.execAction("moveCursorRight"), this.actions);
            this.key.bind("", this.key.ARROW_LEFT, this.execAction("moveCursorLeft"), this.actions);
            this.key.bind("", this.key.ARROW_UP, this.execAction("moveCursorUp"), this.actions);
            this.key.bind("", this.key.ARROW_DOWN, this.execAction("moveCursorDown"), this.actions);
            this.key.bind("", this.key.PAGE_UP, this.execAction("movePageUp"), this.actions);
            this.key.bind("", this.key.PAGE_DOWN, this.execAction("movePageDown"), this.actions);
            this.key.bind("", this.key.HOME, this.execAction("moveToLineStart"), this.actions);
            this.key.bind("", this.key.END, this.execAction("moveToLineEnd"), this.actions);

            this.key.bind("CTRL", this.key.ARROW_RIGHT, this.execAction("moveWordRight"), this.actions);
            this.key.bind("CTRL", this.key.ARROW_LEFT, this.execAction("moveWordLeft"), this.actions);
            
            this.key.bind("", this.key.BACKSPACE, this.execAction("backspace"), this.actions);
            this.key.bind("", this.key.DELETE, this.execAction("deleteKey"), this.actions);
            this.key.bind("", this.key.ENTER, this.execAction("newline"), this.actions);

            // this has to be called, to make the key.binds work!
            this.key.setupEvents(this);

            // cache that stores that number of lines each row should be split
            // NoWL := Number of Wrapped Lines
            this.NoWL = [];

            // This will track the position of the caret's top-left using the cursor movement (so I don't have to expensively calculate it every time)
            this.caret = {top: 0, left: 0};

            // Just defining all the fields (hehe, defining by setting them to undfined...the irony just makes my eyes bleed)
            this.selection = undefined;
            // CpL := Characters per Line
            this.CpL = undefined;
            // LpP := Lines per Page
            this.LpP = undefined;
            // RpP := Rows per Page
            this.RpP = undefined;
            this.font = undefined;
            this.color = undefined;
            this.charSize = {width: 0, height: 0};
        },

        vscrolled: function (e) {
            this.scrollTop = e.value;
            this.repaint();
        },

        onCursorMove: function (e) {
            var old_pos = e.oldPos;
            var new_pos = e.newPos;
            var line_length = this.CpL * this.charSize.width;
            var lines;
            if (this.options.wrap) {
                if (new_pos.row == old_pos.row) {
                    this.caret.top -= Math.floor(old_pos.col / this.CpL) * this.charSize.height;
                    this.caret.top += Math.floor(new_pos.col / this.CpL) * this.charSize.height;
                    this.caret.left = (new_pos.col % this.CpL) * this.charSize.width;
                } else if (new_pos.row > old_pos.row) {
                    lines = 0;
                    lines += this.NoWL[old_pos.row] - Math.floor(old_pos.col / this.CpL);
                    for (var rowIndex = old_pos.row + 1; rowIndex < new_pos.row; rowIndex++)
                        lines += this.NoWL[rowIndex];
                    lines += Math.floor(new_pos.col / this.CpL);
                    this.caret.top += lines * this.charSize.height;
                    this.caret.left = (new_pos.col % this.CpL) * this.charSize.width;
                } else {
                    // newpos.row < oldpos.row
                    lines = 0;
                    lines += Math.floor(old_pos.col / this.CpL);
                    for (var rowIndex = old_pos.row - 1; rowIndex > new_pos.row; rowIndex--)
                        lines += this.NoWL[rowIndex];
                    lines += this.NoWL[new_pos.row] - Math.floor(new_pos.col / this.CpL);
                    this.caret.top -= lines * this.charSize.height;
                    this.caret.left = (new_pos.col % this.CpL) * this.charSize.width;
                }
            } else {
                this.caret.top = new_pos.row * this.charSize.height;
                this.caret.left = new_pos.col * this.charSize.width;
            }
        },

        onModelChange: function (e) {
            // TODO: this could be made smarter by recognizing which lines changed
            // Calculate the Number-of-Wrapped-Lines cache
            var len;
            var line_count = 0; // this will cache the number of lines in the editor in case wrapping is enabled
            for (var rowIndex = 0; rowIndex < this.model.getRowCount(); rowIndex++) {
                len = this.model.getMetaRowLength(rowIndex);
                this.NoWL[rowIndex] = (len == 0) ? 1 : Math.ceil(len / this.CpL);
                line_count += this.NoWL[rowIndex];
            }
            this.vscroll.min = 0;
            this.vscroll.max = line_count * this.charSize.height - this.d().b.ih;
            this.vscroll.extent = this.vscroll.max / this.d().b.ih;
            this.vscroll.addCss("visibility", "visible");
        },

        updateScrollbar: function () {
            this.vscroll.value = this.scrollTop;
            this.vscroll.layout();
            this.vscroll.repaint();
        },

        execAction: function (action) {
            if (this.actions[action] === undefined) return function (e) {};
            return th.hitch(this, function (e) {
                var args = { event: e, pos: th.clone(this.cursor.getCursorPosition()) };
                this.actions[action](args);
            });
        },

        onKeyPress: function(e) {
            var charToPrint = this.key.getPrintableChar(e);
            if (charToPrint) {
                var args = { event: e, pos: th.clone(this.cursor.getCursorPosition()), newchar: charToPrint };
                this.actions.insertCharacter(args);
            }
        },

        getSelection: function () {
            return this.selection;
        },
        
        setSelection: function (selection) {
            this.selection = selection;
        },

        layout: function () {
            if (this.font === undefined) {
                this.font = this.cssValue("font");
                var tmpctx = this.getScratchContext();
                tmpctx.font = this.font;
                this.charSize = tmpctx.measureText("M");
                // I have no idea what ascent means, but in the old editor
                // implementation, the height is 2.8 times the ascent
                this.charSize.height = Math.ceil(this.charSize.ascent * 2.8);
            }
            if (this.color === undefined) {
                this.color = this.cssValue("color");
            }
            var d = this.d();
            this.vscroll.setBounds(d.b.w - 14, 0, 14, d.b.h);
            // effw := Effective Width (textarea width sans the left&right padding)
            var effw = d.b.iw - this.leftPadding - this.rightPadding;
            this.CpL = Math.floor(effw / this.charSize.width);
            // Using ceil and not floor because it's better to be safe (and draw an extra line which will be clipped) than sorry (not painting the line at all)
            this.LpP = Math.ceil((d.b.ih - 0.75 * this.charSize.height) / this.charSize.height);
            //this.LpP = Math.ceil(d.b.ih / this.charSize.height);
            
            this.bus.fire("editor:model:changed", {}, this);
        },

        paintText: function (ctx) {
            var d = this.d();
            var line_length = this.CpL * this.charSize.width;
            var page_height = 0;
            // Start painting from the first-visible-line (fvl) until leaving the visible region.
            //
            //  1. Get the index of the first visible row (topmost) and its pixel offset
            var fvl = this.getFirstVisibleRow(this.scrollTop);
            //  2. Count the number of rows visible on the screen
            var lvl = this.getFirstVisibleRow(this.scrollTop + this.LpP * this.charSize.height);
            //  3. Find the maximum row length, and BTW Calculate the number of lines the rows occupy
            var maxRowLength = -1;
            var l;
            this.RpP = 0;
            for (var i = fvl.row; i <= lvl.row; i++) {
                l = this.getRowLength(i);
                if (l > maxRowLength)
                    maxRowLength = l;
                page_height += this.NoWL[i] * this.charSize.height;
                // This is done to see how many rows fit in one page, for page-up/down to work with wrapped lines
                this.RpP++;
            }
            // Fix the maximum row length to be aligned to the visible line length
            maxRowLength = line_length * Math.ceil(maxRowLength / line_length);
            //  4. Set the size of the temporary canvas to the components height and the length of the longest row
            var tmpctx = this.getScratchContext();
            tmpctx.canvas.height = page_height;
            tmpctx.canvas.width = Math.max(maxRowLength * this.charSize.width, d.b.w);
            tmpctx.translate(0, this.charSize.height * 0.75);
            tmpctx.font = this.font;
            tmpctx.fillStyle = this.color;
            //  5. For every line
            for (var i = fvl.row; i <= lvl.row; i++) {
            //      5.1. Paint the line to the temporaty canvas in any way the user wants
                this.paintRow(tmpctx, i);
            //      5.2. If we are in wrap mode, translate the amount of wrapped lines
                if (this.options.wrap) {
                    tmpctx.translate(0, this.NoWL[i] * this.charSize.height);
            //      5.3. If we are not in wrap mode, just translate one line
                } else {
                    tmpctx.translate(0, this.charSize.height);
                }
            }
            //  6. If wrapping is set, start folding from the temporary canvas to the main canvas
            ctx.translate(this.leftPadding, 0 - fvl.offset);
            if (this.options.wrap) {
                var src_x = 0, src_y = 0, src_w = line_length, src_h = page_height;
                var dst_x = 0, dst_y = 0, dst_w = line_length, dst_h = page_height;
                while (src_x < (maxRowLength * this.charSize.width)) {
                    ctx.drawImage(tmpctx.canvas, src_x, src_y, src_w, src_h, dst_x, dst_y, dst_w, dst_h);
                    src_x += line_length;
                    dst_y += this.charSize.height;
                }
            } else {
                ctx.drawImage(tmpctx.canvas, 0, 0, line_length, page_height, 0, 0, line_length, page_height);
            }
        },

        paintSelf: function (ctx) {
            if (this.model.isEmpty()) return;
            ctx.save();
            this.paintUnderText(ctx);
            ctx.restore();
            ctx.save();
            this.paintText(ctx);
            ctx.restore();
            ctx.save();
            this.paintOverText(ctx);
            ctx.restore();
        },

        adjustScrollTop: function () {
            if (this.caret.top < this.scrollTop) {
                // Scroll up enough to make the top of the cursor visible
                this.scrollTop = this.caret.top;
            } else if ((this.caret.top + this.charSize.height) > (this.scrollTop + this.LpP * this.charSize.height)) {
                // Scroll down enough to make the bottom of the cursor visible
                this.scrollTop = this.caret.top + this.charSize.height - this.LpP * this.charSize.height;
            }
        },

        /*
         * "Virtual" Functions
         */

        paintRow: function (ctx, rowIndex) {
            // Draw one row of text
            // Operations to avoid - translating vertically
            // Just paint what you think the row should look - selection, cursor and any other highlighting or whatever
            var text = this.model.getMetaRowString(rowIndex);
            ctx.fillText(text, 0, 0);
        },

        paintUnderText: function (ctx) {
        },

        paintOverText: function (ctx) {
            ctx.translate(this.leftPadding, 0);
            ctx.fillRect(this.caret.left, this.caret.top - this.scrollTop, 1, this.charSize.height);
        },

        getFirstVisibleRow: function (offset) {
            // return the first visible line that is visible <offset> pixels from the beginning of the document
            if (offset === undefined) offset = this.scrollTop;
            var row;
            if (!this.options.wrap) {
                row = Math.floor(offset / this.charSize.height);
                return {row: row, offset: offset - row * this.charSize.height};
            } else {
                var accum = 0;
                row = 0;
                while ((accum += this.NoWL[row] * this.charSize.height) < offset) {
                    row++;
                }
                return {row: row, offset: offset - accum + this.NoWL[row] * this.charSize.height};
            }
        },

        getRowLength: function (rowIndex) {
            return this.model.getMetaRowLength(rowIndex);
        },

        getPageRowCount: function () {
            if (this.RpP === undefined) return 0;
            return this.RpP;
        }
    }
});

th.SimpleEditor = Class.define({
    type: "SimpleEditor",

    superclass: th.Editor.Template,

    members: {
        init: function (params) {
            this._super(params);
            this.rightPadding = 20;
            this.leftPadding = 30;
            this.options = {};
            this.options.wrap = (params.wrap === undefined) ? false : (params.wrap == "true");
        },
        
        paintRow: function (ctx, rowIndex) {
            var text_length = this.model.getMetaRowLength(rowIndex);
            if (rowIndex == this.cursor.getCursorPosition().row) {
                ctx.save();
                ctx.fillStyle = "#F0F0F0";
                ctx.fillRect(0, -0.75 * this.charSize.height, text_length * this.charSize.width, this.charSize.height);
                ctx.restore();
            }
            this._super(ctx, rowIndex);
        },

        paintUnderText: function (ctx) {
            ctx.fillStyle = "#A9F4CF";
            ctx.fillRect(0, 0, this.leftPadding - 5, this.d().b.ih);
            ctx.fillStyle = "white";
            ctx.fillRect(this.leftPadding - 5, 0, this.d().b.iw - this.leftPadding + 5, this.d().b.ih);
        }
    }
});

th.Editor.Model = Class.define({
    type: "Editor::Model",

    members: {
        init: function (editor) {
            this.editor = editor;
            this.rows = [];
            this.cacheRowMetadata = [];
            this.editor.bus.bind("editor:model:change", this, this.change, this);
        },

        change: function (e) {
            this[e.action].apply(this, th.isArray(e.args) ? e.args : [e.args]);
            this.editor.bus.fire("editor:model:changed", {}, this.editor);
        },

        isEmpty: function() {
            if (this.rows.length > 1) return false;
            if (this.rows.length == 1 && this.rows[0].length > 0) return false;
            return true;
        },

        getDirtyRows: function() {
            var dr = (this.dirtyRows) ? this.dirtyRows : [];
            this.dirtyRows = null;
            return dr;
        },

        setRowDirty: function(row) {
            if (!this.dirtyRows) this.dirtyRows = new Array(this.rows.length);
            this.dirtyRows[row] = true;
        },

        isRowDirty: function(row) {
            if (!this.dirtyRows) return true;
            return this.dirtyRows[row];
        },

        setRowArray: function(rowIndex, row) {  // invalidate
            if (!th.isArray(row)) {
                row = row.split('');
            }
            this.rows[rowIndex] = row;
        },

        // gets the row array for the specified row, creating it and any intermediate rows as necessary
        getRowArray: function(rowIndex) {
            while (this.rows.length <= rowIndex) this.rows.push([]);
            return this.rows[rowIndex];
        },

        getRowLength: function (rowIndex) {
            if (rowIndex < 0 || rowIndex >= this.rows.length)
                return 0;
            return this.rows[rowIndex].length;
        },

        // checks if there is a row at the specified index; useful because getRowArray() creates rows as necessary
        hasRow: function(rowIndex) {
            return (this.rows[rowIndex]);
        },

        // will insert blank spaces if passed col is past the end of passed row
        insertCharacters: function(modelPos, string) {
            var row = this.getRowArray(modelPos.row);
            while (row.length < modelPos.col) row.push(" ");

            var newrow = (modelPos.col > 0) ? row.splice(0, modelPos.col) : [];
            newrow = newrow.concat(string.split(""));
            this.rows[modelPos.row] = newrow.concat(row);

            this.setRowDirty(modelPos.row);
            this.invalidateSyntaxCache(modelPos.row);
        },

        getDocument: function() {
            var file = [];
            for (var x = 0; x < this.getRowCount(); x++) {
                file[x] = this.getRowArray(x).join('');
            }
            return file.join("\n");
        },

        insertDocument: function(content) {
            this.clear();
            var rows = content.split("\n");
            for (var x = 0; x < rows.length; x++) {
                this.insertCharacters({ row: x, col: 0 }, rows[x]);
            }
        },

        changeEachRow: function(changeFunction) {
            for (var x = 0; x < this.getRowCount(); x++) {
                var row = this.getRowArray(x);
                row = changeFunction(row);
                this.setRowArray(x, row);
            }
        },

        replace: function(search, replace) {
            var regex = new RegExp(search, "g");
            for (var x = 0; x < this.getRowCount(); x++) {
                var line = this.getRowArray(x).join('');
                var newline = line.replace(regex, replace);
                if (newline != line) {
                    this.rows[x] = newline.split('');
                }
            }
        },

        // will silently adjust the length argument if invalid
        deleteCharacters: function(modelPos, length) {
            var row = this.getRowArray(modelPos.row);
            var diff = (modelPos.col + length - 1) - row.length;
            if (diff > 0) length -= diff;
            if (length > 0) {
                this.setRowDirty(modelPos.row);
                this.invalidateSyntaxCache(modelPos.row);

                return row.splice(modelPos.col, length).join("");
            }
            return "";
        },

        clear: function() {
            this.rows = [];
            this.cacheRowMetadata = [];
        },

        deleteRows: function(row, count) {
            var diff = (row + count - 1) - this.rows.length;
            if (diff > 0) count -= diff;
            if (count > 0) {
                this.rows.splice(row, count);
                this.cacheRowMetadata.splice(row, count);
            }
        },

        // splits the passed row at the col specified, putting the right-half on a new line beneath the passed row
        splitRow: function(modelPos, autoindent) {
            this.invalidateSyntaxCache(modelPos.row);
            this.setRowDirty(modelPos.row);

            var row = this.getRowArray(modelPos.row); 

            var newRow;
            if (autoindent && autoindent.length > 0) {
                newRow = autoindent;
            } else {
                newRow = [];
            }

            if (modelPos.col < row.length) {
                newRow = newRow.concat(row.splice(modelPos.col));
            }

            if (modelPos.row == (this.rows.length - 1)) {
                this.rows.push(newRow);
            } else {
                var newRows = this.rows.splice(0, modelPos.row + 1);
                newRows.push(newRow);
                newRows = newRows.concat(this.rows);
                this.rows = newRows;

                var newCacheRowMetadata = this.cacheRowMetadata.splice(0, modelPos.row + 1);
                newCacheRowMetadata.push(undefined);
                this.cacheRowMetadata = newCacheRowMetadata.concat(this.cacheRowMetadata);
            }
        },

        // joins the passed row with the row beneath it; optionally removes leading whitespace as well.
        joinRow: function(rowIndex, autounindentSize) {
            this.invalidateSyntaxCache(rowIndex);
            this.setRowDirty(rowIndex);

            if (rowIndex >= this.rows.length - 1) return;
            var row = this.getRowArray(rowIndex);
            var nextrow = this.rows[rowIndex + 1];

            //first, remove any autoindent
            if (typeof autounindentSize != "undefined") {
                nextrow.splice(0, autounindentSize)
            }
       
            //now, remove the row
            this.rows[rowIndex] = row.concat(nextrow);
            this.rows.splice(rowIndex + 1, 1);
        
            this.cacheRowMetadata.splice(rowIndex + 1, 1);
        },

        // returns the number of rows in the model
        getRowCount: function() {
            return this.rows.length;
        },

        // returns a "chunk": a string representing a part of the document with \n characters representing end of line
        getChunk: function(selection) {
            var startModelPos = selection.startPos;
            var endModelPos = selection.endPos;

            var startModelCol, endModelCol;
            var chunk = "";

            // get the first line
            startModelCol = startModelPos.col;
            var row = this.getRowArray(startModelPos.row);
            endModelCol = (endModelPos.row == startModelPos.row) ? endModelPos.col : row.length;
            if (endModelCol > row.length) endModelCol = row.length;
            chunk += row.join("").substring(startModelCol, endModelCol);

            // get middle lines, if any
            for (var i = startModelPos.row + 1; i < endModelPos.row; i++) {
                chunk += "\n";
                chunk += this.getRowArray(i).join("");
            }

            // get the end line
            if (startModelPos.row != endModelPos.row) {
                startModelCol = 0;
                endModelCol = endModelPos.col;
                row = this.getRowArray(endModelPos.row);
                if (endModelCol > row.length) endModelCol = row.length;
                chunk += "\n" + row.join("").substring(startModelCol, endModelCol);
            }

            return chunk;
        },

        // deletes the text between the startPos and endPos, joining as necessary. startPos and endPos are inclusive
        deleteChunk: function(selection) {
            var chunk = this.getChunk(selection);

            var startModelPos = selection.startPos;
            var endModelPos = selection.endPos;

            this.invalidateSyntaxCache(startModelPos.row);

            var startModelCol, endModelCol;

            // get the first line
            startModelCol = startModelPos.col;
            var row = this.getRowArray(startModelPos.row);
            endModelCol = (endModelPos.row == startModelPos.row) ? endModelPos.col : row.length;
            if (endModelCol > row.length) endModelCol = row.length;
            this.deleteCharacters({ row: startModelPos.row, col: startModelCol }, endModelCol - startModelCol);

            // get the end line
            if (startModelPos.row != endModelPos.row) {
                startModelCol = 0;
                endModelCol = endModelPos.col;
                row = this.getRowArray(endModelPos.row);
                if (endModelCol > row.length) endModelCol = row.length;
                this.deleteCharacters({ row: endModelPos.row, col: startModelCol }, endModelCol - startModelCol);
            }

            // remove any lines in-between
            if ((endModelPos.row - startModelPos.row) > 1) this.deleteRows(startModelPos.row + 1, endModelPos.row - startModelPos.row - 1);

            // join the rows
            if (endModelPos.row != startModelPos.row) this.joinRow(startModelPos.row);

            return chunk;
        },

        // inserts the chunk and returns the ending position
        insertChunk: function(modelPos, chunk) {
            this.invalidateSyntaxCache(modelPos.row);

            var lines = chunk.split("\n");
            var cModelPos = th.clone(modelPos);
            for (var i = 0; i < lines.length; i++) {
                this.insertCharacters(cModelPos, lines[i]);
                cModelPos.col = cModelPos.col + lines[i].length;

                if (i < lines.length - 1) {
                    this.splitRow(cModelPos);
                    cModelPos.col = 0;
                    cModelPos.row = cModelPos.row + 1;
                }
            } 

            return cModelPos;
        },
    
        // returns various metadata about the row, mainly concerning tab information
        // uses a cache to speed things up
        getRowMetadata: function(row) {
            // check if we can use the cached RowMetadata
            if (!this.isRowDirty(row) && this.cacheRowMetadata[row]) {
                return this.cacheRowMetadata[row];
            }
        
            // No cache or row is dirty? Well, then we have to calculate things new...
        
            // contains the row metadata; this object is returned at the end of the function
            var meta = { tabExpansions: [] };

            var rowArray = this.editor.model.getRowArray(row);
            var lineText = rowArray.join("");
            var tabsize = th.Settings.get('tabSize');

            meta.lineTextWithoutTabExpansion = lineText;
            meta.lineLengthWithoutTabExpansion = rowArray.length;

            // check for tabs and handle them
            for (var ti = 0; ti < lineText.length; ti++) {
                // check if the current character is a tab
                if (lineText.charCodeAt(ti) == 9) {
                    // since the current character is a tab, we potentially need to insert some blank space between the tab character
                    // and the next tab stop
                    var toInsert = tabsize - (ti % tabsize);

                    // create a spacer string representing the space between the tab and the tabstop
                    var spacer = "";
                    for (var si = 1; si < toInsert; si++) spacer += " ";

                    // split the row string into the left half and the right half (eliminating the tab character) in preparation for
                    // creating a new row string
                    var left = (ti == 0) ? "" : lineText.substring(0, ti);
                    var right = (ti < lineText.length - 1) ? lineText.substring(ti + 1) : "";

                    // create the new row string; the blank space essentially replaces the tab character
                    lineText = left + " " + spacer + right;
                    meta.tabExpansions.push({ start: left.length, end: left.length + spacer.length + 1 });

                    // increment the column counter to correspond to the new space
                    ti += toInsert - 1;
                }
            }

            meta.lineText = lineText;
        
            if (this.editor.searchString) {
                meta.searchIndices = this.getStringIndicesInRow(row, this.editor.searchString);            
            } else {
                meta.searchIndices = false;
            }

            // save the calcualted metadata to the cache
            this.cacheRowMetadata[row] = meta;

            return meta;
        },

        invalidateSyntaxCache: function (rowIndex) {
            if (typeof this.editor.syntaxModel != "undefined" && th.isFunction(this.editor.syntaxModel.invalidateCache))
                this.editor.syntaxModel.invalidateCache(rowIndex);
        },

        getMetaRowString: function (rowIndex) {
            return this.getRowMetadata(rowIndex).lineText;
        },

        getMetaRowLength: function (rowIndex) {
            return this.getRowMetadata(rowIndex).lineText.length;
        }
    }
});

th.Editor.Cursor = Class.define({
    type: "Editor::Cursor",

    members: {
        init: function(editor) {
            this.model = editor.model;
            this.editor = editor;
            this.position = { row: 0, col: 0 };
            this.virtualCol = 0;

            this.editor.bus.bind("editor:cursor:move", this, this.move, this);
        },

        move: function (e) {
            var oldpos = th.clone(this.position);
            var ret = this[e.action](e.args);
            var newpos = th.clone(this.position);
            this.editor.bus.fire("editor:cursor:moved", {oldPos: oldpos, newPos: newpos}, this.editor);
        },

        // Returns 'this.position' or 'pos' from optional input 'modelPos'
        getCursorPosition: function(modelPos) {
            if (modelPos != undefined) {
                var pos = th.clone(modelPos);
                var line = this.model.getRowArray(pos.row);
                var tabsize = th.Settings.get("tabSize");

                // Special tab handling
                if (line.indexOf("\t") != -1) {
    //              console.log( 'Cursor modelPos.col/pos.col begin: ', modelPos.col, pos.col );
                    var tabs = 0, nottabs = 0;

                    for (var i = 0; i < modelPos.col; i++) {
                        if (line[i] == "\t") {
                            pos.col += tabsize - 1 - ( nottabs % tabsize );
                            tabs++;
                            nottabs = 0;
                        } else {
                            nottabs++;
                            tabs = 0;
                        }
    //                  console.log( 'tabs: ' + tabs, 'nottabs: ' + nottabs, 'pos.col: ' + pos.col );
                    }

    //              console.log( 'Cursor modelPos.col/pos.col end: ' + modelPos.col, pos.col );
                }

                return pos;
            } else {
                return this.position;
            }
        },

        // Returns 'modelPos' from optional input 'pos' or 'this.position'
        getModelPosition: function(pos) {
            pos = (pos != undefined) ? pos : this.position;
            var modelPos = th.clone(pos);
            var line = this.model.getRowArray(pos.row);
            var tabsize = th.Settings.get("tabSize");

            // Special tab handling
            if (line.indexOf("\t") != -1) {
    //          console.log( 'Model modelPos.col/pos.col begin: ', modelPos.col, pos.col );
                var tabs = 0, nottabs = 0;

                for (var i = 0; i < modelPos.col; i++) {
                    if (line[i] == "\t") {
                        modelPos.col -= tabsize - 1 - ( nottabs % tabsize );
                        tabs++;
                        nottabs = 0;
                    } else {
                        nottabs++;
                        tabs = 0;
                    }
    //              console.log( 'tabs: ' + tabs, 'nottabs: ' + nottabs, 'modelPos.col: ' + modelPos.col );
                }

    //          console.log( 'Model modelPos.col/pos.col end: ' + modelPos.col, pos.col );
            }

            return modelPos;
        },
        
        getCharacterLength: function(character, column) {
            if (character.length > 1) return;
            if (column == undefined) column = this.position.col;
            if (character == "\t") {
                var tabsize = th.Settings.get("tabSize");
                return (tabsize - (column % tabsize));
            } else {
                return 1;
            }
        },

        // Returns the length of a given string. This takes '\t' in account!
        getStringLength: function(str) {
            if (!str || str.length == 0) return 0;
            var count = 0;
            str = str.split("");
            for (var x = 0; x < str.length; x++) {
                count += this.getCharacterLength(str[x], count);
            }
            return count;
        },
        
        // returns the numbers of white spaces from the beginning of the line
        // tabs are counted as whitespace
        getLeadingWhitespace: function(rowIndex) {
            var row = this.model.getRowArray(rowIndex).join("");
            var match = /^(\s+).*/.exec(row);
            return (match && match.length == 2 ? this.getStringLength(match[1]) : 0);
        },
        
        // Returns the numbers of white spaces (NOT '\t'!!!) in a row
        // if the string between <from> and <to> is "  ab     " this will give you 2, as
        // there are 2 white spaces together from the beginning
        getContinuousSpaceCount: function(from, to, rowIndex) {
            rowIndex = rowIndex || this.position.row;
            var settings = th.Settings;
            var row = this.model.getRowArray(rowIndex);
            var delta = (from < to ? 1 : -1);
            var length = row.length;
            from = from + (delta == 1 ? 0 : -1);
            to = to + (delta == 1 ? 0 : -1);
            from = this.getModelPosition({col: from, row: rowIndex}).col;
            to = this.getModelPosition({col: to, row: rowIndex}).col;
            if (settings.isSettingOn('strictlines')) {
                from = Math.min(from, length);
                to = Math.min(to, length);            
            }
            var count = 0;
            for (var x = from; x != to; x += delta) {
                if (x < length) {
                    if (row[x] != ' ') {
                        break;
                    }   
                }
                count++;
            }
            return count;
        },
        
        getNextTablevelLeft: function(col) {
            var tabsize = th.Settings.get("tabSize");
            col = col || this.position.col;
            col--;
            return Math.floor(col / tabsize) * tabsize;
        },
        
        getNextTablevelRight: function(col) {
            var tabsize = th.Settings.get("tabSize");
            col = col || this.position.col;
            col++;
            return Math.ceil(col / tabsize) * tabsize;
        },

        moveToLineStart: function() {
            var oldPos = th.clone(this.position);
            var leadingWhitespaceLength = this.getLeadingWhitespace(oldPos.row);

            if (this.position.col == 0) {
                this.moveCursor({ col:  leadingWhitespaceLength });
            } else if (this.position.col == leadingWhitespaceLength) {
                this.moveCursor({ col: 0 });
            } else if(leadingWhitespaceLength != this.model.getMetaRowLength(this.getCursorPosition().row)){
                this.moveCursor({ col: leadingWhitespaceLength });
            } else {
                this.moveCursor({ col: 0 });
            }

            return { oldPos: oldPos, newPos: th.clone(this.position) };
        },

        moveToLineEnd: function() {
            var oldPos = th.clone(this.position);

            this.moveCursor({ col: this.model.getMetaRowLength(oldPos.row) });

            return { oldPos: oldPos, newPos: th.clone(this.position) };
        },

        moveToTop: function() {
            var oldPos = th.clone(this.position);

            this.moveCursor({ row: 0, col: 0 });

            return { oldPos: oldPos, newPos: th.clone(this.position) };
        },

        moveToBottom: function() {
            var oldPos = th.clone(this.position);

            var row = this.editor.getRowCount() - 1;
            this.moveCursor({ row: row, col: this.model.getMetaRowLength(row) });

            return { oldPos: oldPos, newPos: th.clone(this.position) };
        },

        moveUp: function() {
            var settings = th.Settings;
            var selection = this.editor.getSelection();
            var oldPos = th.clone(this.position);
            var oldVirualCol = this.virtualCol;

            this.moveCursor({ row: oldPos.row - 1, col: Math.max(oldPos.col, this.virtualCol) });

            if (settings.isSettingOn('strictlines') && this.position.col > this.model.getMetaRowLength(this.position.row)) {
                this.moveToLineEnd();   // this sets this.virtulaCol = 0!
                this.virtualCol = Math.max(oldPos.col, oldVirualCol);
            }

            return { oldPos: oldPos, newPos: th.clone(this.position) };
        },

        moveDown: function() {
            var settings = th.Settings;
            var selection = this.editor.getSelection();

            var oldPos = th.clone(this.position);
            var oldVirualCol = this.virtualCol;

            this.moveCursor({ row: Math.max(0, oldPos.row + 1), col: Math.max(oldPos.col, this.virtualCol) });

            if (settings.isSettingOn('strictlines') && this.position.col > this.model.getMetaRowLength(this.position.row)) {
                this.moveToLineEnd();   // this sets this.virtulaCol = 0!
                this.virtualCol = Math.max(oldPos.col, oldVirualCol);
            }

            return { oldPos: oldPos, newPos: th.clone(this.position) };
        },

        moveLeft: function(args) {
            var settings = th.Settings;
            var tabsize = settings.get("tabSize");
            var oldPos = th.clone(this.position);
            var shiftKey = (args.event ? args.event.shiftKey : false);

            if (!this.editor.getSelection() || shiftKey) {
                if (settings.isSettingOn('smartmove')) {
                    var freeSpaces = this.getContinuousSpaceCount(oldPos.col, this.getNextTablevelLeft());
                    if (freeSpaces == tabsize) {
                        this.moveCursor({ col: oldPos.col - freeSpaces });  
                        return { oldPos: oldPos, newPos: th.clone(this.position) }
                    } // else {
                    //  this case is handled by the code following
                    //}
                }

                // start of the line so move up
                if (settings.isSettingOn('strictlines') && (this.position.col == 0)) {
                    this.moveUp();
                    if (oldPos.row > 0) this.moveToLineEnd();
                } else {
                    this.moveCursor({ row: oldPos.row, col: Math.max(0, oldPos.col - 1) });
                }
            } else {
                this.moveCursor(this.editor.getSelection().startPos);
            }

            return { oldPos: oldPos, newPos: th.clone(this.position) };
        },

        moveRight: function(args) {
            var settings = th.Settings;
            var tabsize = settings.get("tabSize");
            var oldPos = th.clone(this.position);
            var shiftKey = (args.event ? args.event.shiftKey : false);

            if (!this.editor.getSelection() || shiftKey) {
                if (settings.isSettingOn('smartmove') && args != true) {
                    var freeSpaces = this.getContinuousSpaceCount(oldPos.col, this.getNextTablevelRight());                       
                    if (freeSpaces == tabsize) {
                        this.moveCursor({ col: oldPos.col + freeSpaces })  
                        return { oldPos: oldPos, newPos: th.clone(this.position) }
                    }// else {
                    //  this case is handled by the code following
                    //}
                }

                // end of the line, so go to the start of the next line
                if (settings.isSettingOn('strictlines') && (this.position.col >= this.model.getMetaRowLength(this.position.row))) {
                    this.moveDown();
                    if (oldPos.row < this.model.getRowCount() - 1) this.moveCursor({col: 0});
                } else {
                    this.moveCursor({ col: this.position.col + 1 });
                }
            } else {
                this.moveCursor(this.editor.getSelection().endPos);
            }

            return { oldPos: oldPos, newPos: th.clone(this.position) };
        },

        movePageUp: function() {
            var oldPos = th.clone(this.position);

            this.moveCursor({ row: Math.max(oldPos.row - this.editor.getPageRowCount(), 0) });

            return { oldPos: oldPos, newPos: th.clone(this.position) };
        },

        movePageDown: function() {
            var oldPos = th.clone(this.position);

            this.moveCursor({ row: Math.min(oldPos.row + this.editor.getPageRowCount(), this.editor.model.getRowCount() - 1) });

            return { oldPos: oldPos, newPos: th.clone(this.position) };
        },

        smartMoveLeft: function() {
            var oldPos = th.clone(this.position);

            var row = this.model.getMetaRowString(oldPos.row);

            var c, charCode;

            if (this.position.col == 0) { // -- at the start to move up and to the end
                this.moveUp();
                this.moveToLineEnd();
            } else {
                // Short circuit if cursor is ahead of actual spaces in model
                if (row.length < this.position.col) this.moveToLineEnd();

                var newcol = this.position.col;

                // This slurps up trailing spaces
                var wasSpaces = false;
                while (newcol > 0) {
                    newcol--;

                    c = row.charAt(newcol);
                    charCode = c.charCodeAt(0);
                    if (charCode == 32 /*space*/) {
                        wasSpaces = true;
                    } else {
                        newcol++;
                        break;
                    }
                }

                // This jumps to stop words
                if (!wasSpaces) {
                    while (newcol > 0) {
                        newcol--;
                        c = row.charAt(newcol);
                        charCode = c.charCodeAt(0);
                        if ( (charCode < 65) || (charCode > 122) ) { // if you get to an alpha you are done
                            if (newcol != this.position.col - 1) newcol++; // right next to a stop char, move back one
                            break;
                        }
                    }
                }

                this.moveCursor({ col: newcol });
            }

            return { oldPos: oldPos, newPos: th.clone(this.position) };
        },

        smartMoveRight: function() {
            var oldPos = th.clone(this.position);

            var row = this.model.getMetaRowString(oldPos.row);

            if (row.length <= this.position.col) { // -- at the edge so go to the next line
                this.moveDown();
                this.moveToLineStart();
            } else {
                var c, charCode;

                var newcol = this.position.col;

                // This slurps up leading spaces
                var wasSpaces = false;
                while (newcol < row.length) {
                    c = row[newcol];
                    charCode = c.charCodeAt(0);
                    if (charCode == 32 /*space*/) {
                        wasSpaces = true;
                        newcol++;
                    } else {
                        break;
                    }
                }

                // This jumps to stop words
                if (!wasSpaces) {
                    while (newcol < row.length) {
                        newcol++;

                        if (row.length == newcol) { // one more to go
                            this.moveToLineEnd();
                            newcol = -1;
                            break;
                        }

                        c = row[newcol];
                        charCode = c.charCodeAt(0);

                        if ( (charCode < 65) || (charCode > 122) ) {
                            break;
                        }
                    }
                }

                if (newcol != -1) this.moveCursor({ col: newcol });
            }

            return { oldPos: oldPos, newPos: th.clone(this.position) };
        },

        moveCursor: function(newpos) {
            if (!newpos) return; // guard against a bad position (certain redo did this)
            if (newpos.col === undefined) newpos.col = this.position.col;
            if (newpos.row === undefined) newpos.row = this.position.row;

            this.virtualCol = 0;
            var oldpos = this.position;

            var row = Math.min(newpos.row, this.model.getRowCount() - 1); // last row if you go over
            if (row < 0) row = 0; // can't move negative off screen

            var invalid = this.isInvalidCursorPosition(row, newpos.col);
            if (invalid) {
                // console.log('Comparing (' + oldpos.row + ',' + oldpos.col + ') to (' + newpos.row + ',' + newpos.col + ') ...');
                // console.log("invalid position: " + invalid.left + ", " + invalid.right + "; half: " + invalid.half);
                if (oldpos.row != newpos.row) {
                    newpos.col = invalid.right;
                } else if (oldpos.col < newpos.col) {
                    newpos.col = invalid.right;
                } else if (oldpos.col > newpos.col) {
                    newpos.col = invalid.left;
                } else {
                    // default
                    newpos.col = invalid.right;
                }
            }

            this.position = { row: row, col: newpos.col };
            // console.log('Position: (' + this.position.row + ', ' + this.position.col + ')', '[' + this.getModelPosition().col + ']');

            // keeps the editor's cursor from blinking while moving it
            // var editorUI = bespin.get('editor').ui;
            // editorUI.showCursor = true;
            // editorUI.toggleCursorAllowed = false;
        },

        // Pass in a screen position; returns undefined if the postion is valid, otherwise returns closest left and right valid positions
        isInvalidCursorPosition: function(row, col) {
            var settings = th.Settings;
            var tabsize = settings.get("tabSize");
            var rowArray = this.model.getRowArray(row);

            // we need to track the cursor position separately because we're stepping through the array, not the row string
            var curCol = 0;
            for (var i = 0; i < rowArray.length; i++) {
                if (rowArray[i].charCodeAt(0) == 9) {
                    // if current character in the array is a tab, work out the white space between here and the tab stop
                    var toInsert = tabsize - (curCol % tabsize);

                    // if the passed column is in the whitespace between the tab and the tab stop, it's an invalid position
                    if ((col > curCol) && (col < (curCol + toInsert))) {
                        return { left: curCol, right: curCol + toInsert, half: toInsert / 2 };
                    }

                    curCol += toInsert - 1;
                }
                curCol++;
            }

            return undefined;
        }
    }
});

th.Editor.Actions = Class.define({
    members: {
        init: function(editor) {
            this.editor = editor;
            this.model = editor.model;
            this.cursorManager = editor.cursor;
            this.ignoreRepaints = false;
        },

        moveCursor: function(moveType, args) {
            //var posData = this.cursorManager[moveType](args);
            this.editor.bus.fire("editor:cursor:move", {action: moveType, args: args}, this.cursorManager);
            this.repaint();
            //args.pos = posData.newPos;
            //return args;
        },

        moveCursorLeft: function(args) {
            return this.moveCursor("moveLeft", args);
        },

        moveCursorRight: function(args) {
            return this.moveCursor("moveRight", args);
        },

        moveCursorUp: function(args) {
            return this.moveCursor("moveUp", args);
        },

        moveCursorDown: function(args) {
            return this.moveCursor("moveDown", args);
        },

        moveToLineStart: function(args) {
            return this.moveCursor("moveToLineStart", args);
        },

        moveToLineEnd: function(args) {
            return this.moveCursor("moveToLineEnd", args);
        },

        moveToFileTop: function(args) {
            return this.moveCursor("moveToTop", args);
        },

        moveToFileBottom: function(args) {
            return this.moveCursor("moveToBottom", args);
        },

        movePageUp: function(args) {
            return this.moveCursor("movePageUp", args);
        },

        movePageDown: function(args) {
            return this.moveCursor("movePageDown", args);
        },

        moveWordLeft: function(args) {
            return this.moveCursor("smartMoveLeft", args);
        },

        moveWordRight: function(args) {
            return this.moveCursor("smartMoveRight", args);
        },

        backspace: function(args) {
            var settings = th.Settings;
            if (this.editor.readonly) return;

            if (this.editor.selection) {
                this.deleteSelection(args);
            } else {
                if (args.pos.col > 0) {
                    if (settings.isSettingOn('smartmove')) {
                        var tabsize = settings.get("tabSize");
                        var freeSpaces = this.cursorManager.getContinuousSpaceCount(args.pos.col, this.cursorManager.getNextTablevelLeft(args.pos.col));
                        if (freeSpaces == tabsize) {
                            var pos = args.pos;
                            this.editor.selection = { startPos: { row: pos.row, col: pos.col - tabsize}, endPos: {row: pos.row, col: pos.col}};
                            this.deleteSelection(args);
                            return;
                        }
                    }
                    //this.cursorManager.moveCursor({ col:  Math.max(0, args.pos.col - 1) });
                    this.editor.bus.fire("editor:cursor:move", {action: "moveCursor", args: { col:  Math.max(0, args.pos.col - 1) }}, this.cursorManager);
                    args.pos.col -= 1;
                    this.deleteCharacter(args);
                } else {
                    args.joinDirection = "up";
                    this.joinLine(args);
                }
            }
        },

        deleteCharacter: function(args) {
            if (this.editor.readonly) return;

            if (args.pos.col < this.model.getMetaRowLength(args.pos.row)) {
                var modelPos = this.cursorManager.getModelPosition(args.pos);
//                var deleted = this.model.deleteCharacters(modelPos, 1);
                this.editor.bus.fire("editor:model:change", {action: "deleteCharacters", args: [modelPos, 1]}, this.model);
                this.repaint();

                // undo/redo
/*                args.action = "deleteCharacter";
                var redoOperation = args;
                var undoArgs = { action: "insertCharacter", pos: bespin.editor.utils.copyPos(args.pos), queued: args.queued, newchar: deleted };
                var undoOperation = undoArgs;
                this.editor.undoManager.addUndoOperation(new bespin.editor.UndoItem(undoOperation, redoOperation));*/
            }
        },

        deleteSelection: function(args) {
            if (this.editor.readonly || !this.editor.selection) return;

            var selection;

            //first, check to see if we had one saved, because if we did, that is the one we want.
            if (args.selection) selection = args.selection;
            else selection = this.editor.getSelection();

            var chunk = this.model.getChunk(selection);
//            this.model.deleteChunk(selection);
            this.editor.bus.fire("editor:model:change", {action: "deleteChunk", args: [selection]}, this.model);

/*            // undo/redo
            args.action = "deleteSelection";
            var redoOperation = args;
            redoOperation.selection = selection;

            var undoArgs = {
                action: "insertChunkAndSelect",
                pos: bespin.editor.utils.copyPos(selection.startPos),
                queued: args.queued,
                chunk: chunk
            };

            var undoOperation = undoArgs;
            this.editor.undoManager.addUndoOperation(new bespin.editor.UndoItem(undoOperation, redoOperation));
*/
            // setting the selection to undefined has to happen *after* we enqueue the undoOp otherwise replay breaks
            this.editor.setSelection(undefined);
//            this.cursorManager.moveCursor(selection.startPos);
            this.editor.bus.fire("editor:cursor:move", {action: "moveCursor", args: selection.startPos}, this.cursorManager);
            this.repaint();

            return chunk;
        },

        joinLine: function(args) {
            if (this.editor.readonly) return;

            if (args.joinDirection == "up") {
                if (args.pos.row == 0) return;

                var newcol = this.model.getMetaRowLength(args.pos.row - 1);
//                this.model.joinRow(args.pos.row - 1, args.autounindentSize);
                this.editor.bus.fire("editor:model:change", {action: "joinRow", args: [args.pos.row - 1, args.autoindentSize]}, this.model);
//                this.cursorManager.moveCursor({ row: args.pos.row - 1, col: newcol });
                this.editor.bus.fire("editor:cursor:move", {action: "moveCursor", args: { row: args.pos.row - 1, col: newcol }}, this.cursorManager);
            } else {
                if (args.pos.row >= this.model.getRowCount() - 1) return;

                //this.model.joinRow(args.pos.row);
                this.editor.bus.fire("editor:model:change", {action: "joinRow", args: args.pos.row}, this.model);
            }

/*            // undo/redo
            args.action = "joinLine";
            var redoOperation = args;
            var undoArgs = { action: "newline", pos: bespin.editor.utils.copyPos(this.editor.getCursorPos()), queued: args.queued };
            var undoOperation = undoArgs;
            this.editor.undoManager.addUndoOperation(new bespin.editor.UndoItem(undoOperation, redoOperation));
*/
            this.repaint();
        },

        deleteKey: function(args) {
            var settings = th.Settings;

            if (this.editor.readonly) return;

            if (this.editor.selection) {
                this.deleteSelection(args);
            } else {
                if (args.pos.col < this.model.getMetaRowLength(args.pos.row)) {
                    if (settings.isSettingOn('smartmove')) {
                        var tabsize = settings.get("tabSize");
                        var freeSpaces = this.cursorManager.getContinuousSpaceCount(args.pos.col, this.cursorManager.getNextTablevelRight(args.pos.col));
                        if (freeSpaces == tabsize) {
                            var pos = args.pos;
                            this.editor.selection = { startPos: { row: pos.row, col: pos.col}, endPos: {row: pos.row, col: pos.col + tabsize}};
                            this.deleteSelection(args);
                            return;
                        }
                    }
                    this.deleteCharacter(args);
                } else {
                    args.joinDirection = "down";
                    this.joinLine(args);
                }
            }
        },

        deleteCharacter: function(args) {
            if (this.editor.readonly) return;

            if (args.pos.col < this.model.getMetaRowLength(args.pos.row)) {
                var modelPos = this.cursorManager.getModelPosition(args.pos);
//                var deleted = this.model.deleteCharacters(modelPos, 1);
                this.editor.bus.fire("editor:model:change", {action: "deleteCharacters", args: [modelPos, 1]}, this.model);
                this.repaint();

/*                // undo/redo
                args.action = "deleteCharacter";
                var redoOperation = args;
                var undoArgs = { action: "insertCharacter", pos: bespin.editor.utils.copyPos(args.pos), queued: args.queued, newchar: deleted };
                var undoOperation = undoArgs;
                this.editor.undoManager.addUndoOperation(new bespin.editor.UndoItem(undoOperation, redoOperation));
*/
            }
        },

        newline: function(args) {
            if (this.editor.readonly) return;

            var settings = th.Settings;
            var autoindent = th.leadingWhitespace(this.model.getRowArray(args.pos.row));
            var autoindentSize = 0, tabsize = settings.get("tabSize");
            //calculate equivalent number of spaces in autoindent
            for (var i = 0; i < autoindent.length; i++) {
                if (autoindent[i] == ' ' || autoindent[i] == '' || autoindent[i] === undefined) autoindentSize++;
                else if (autoindent[i] == '\t') autoindentSize += tabsize;
                else break;
            }

//            this.model.splitRow(this.cursorManager.getModelPosition(args.pos), autoindent);
            this.editor.bus.fire("editor:model:change", {action: "splitRow", args: [this.cursorManager.getModelPosition(args.pos), autoindent]}, this.model);
//            this.cursorManager.moveCursor({ row: this.cursorManager.getCursorPosition().row + 1, col: autoindentSize });
            this.editor.bus.fire("editor:cursor:move", {action: "moveCursor", args: { row: this.cursorManager.getCursorPosition().row + 1, col: autoindentSize }}, this.cursorManager);

/*            // undo/redo
            args.action = "newline";
            var redoOperation = args;
            var undoArgs = {
                action: "joinLine",
                joinDirection: "up",
                pos: bespin.editor.utils.copyPos(this.cursorManager.getCursorPosition()),
                queued: args.queued,
                autounindentSize: autoindent.length
            };
            var undoOperation = undoArgs;
            this.editor.undoManager.addUndoOperation(new bespin.editor.UndoItem(undoOperation, redoOperation));
*/

            this.repaint();
        },

        insertCharacter: function(args) {
            if (this.editor.readonly) return;

            if (this.editor.selection) {
                this.deleteSelectionAndInsertCharacter(args);
            } else {
                //this.model.insertCharacters(this.cursorManager.getModelPosition(args.pos), args.newchar);
                this.editor.bus.fire("editor:model:change", {action: "insertCharacters", args: [this.cursorManager.getModelPosition(args.pos), args.newchar]}, this.model);
                //this.cursorManager.moveRight(true);
                this.editor.bus.fire("editor:cursor:move", {action: "moveRight", args: true}, this.cursorManager);

                this.repaint();

/*                // undo/red
                args.action = "insertCharacter";
                var redoOperation = args;
                var undoArgs = { action: "deleteCharacter", pos: bespin.editor.utils.copyPos(args.pos), queued: args.queued };
                var undoOperation = undoArgs;
                this.editor.undoManager.addUndoOperation(new bespin.editor.UndoItem(undoOperation, redoOperation));
*/
            }
        },

        repaint: function() {
            if (!this.ignoreRepaints) {
                this.editor.adjustScrollTop();
                this.editor.updateScrollbar();
                this.editor.repaint();
            }
        }
    }
});
