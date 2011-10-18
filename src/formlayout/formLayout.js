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
 * The Original Code is JGoodies FormLayout.
 *
 * The Initial Developer of the Original Code is JGoodies Karsten Lentzsch.
 * Portions created by the Initial Developer are Copyright (C) 2009
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Bespin Team (bespin@mozilla.com)
 *
 *             The BSD License for the JGoodies Forms
 *             ======================================
 *
 * Copyright (c) 2002-2008 JGoodies Karsten Lentzsch. All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *
 * o Redistributions of source code must retain the above copyright notice,
 *   this list of conditions and the following disclaimer.
 *
 * o Redistributions in binary form must reproduce the above copyright notice,
 *   this list of conditions and the following disclaimer in the documentation
 *   and/or other materials provided with the distribution.
 *
 * o Neither the name of JGoodies Karsten Lentzsch nor the names of
 *   its contributors may be used to endorse or promote products derived
 *   from this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
 * AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO,
 * THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR
 * PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR
 * CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL,
 * EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO,
 * PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS;
 * OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY,
 * WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR
 * OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE,
 * EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 *
 * ***** END LICENSE BLOCK ***** */

if (typeof th == "undefined") th = {};

/*
 * This code is part of a partial port of JGoodies Karsten Lentzsch's excellent JGoodies FormLayout, a layout manager for
 * Java Swing. For more information, see http://www.jgoodies.com/freeware/forms/.
 *
 * NOTES:
 * - Most assert-style exception guards (e.g., null checks) have been removed
 *
 * - Defensive copying (e.g., clone, deepClone) has been removed
 *
 * - Any comments inside of methods were returned (pretty much none were present in original source); JavaDoc comments were not.
 *   See the original source for these; should apply 1:1 modulo standard Java<->JavaScript stuff
 *
 * - It was literally painful to include Java-style getters and setters, but I did so to avoid having to replace all invocations
 *   of these methods as I ported; e.g., I wasn't sure how often a subclass might override a getter/setter to provide extra
 *   functionality. These should be removed in a second pass.
 *
 * - I haven't implemented the string-based layout DSL yet; the following classes have omitted methods which need to be added
 *   to support this feature (may not be a complete list):
 *   - FormSpec, ColumnSpec
 *
 * - The following methods required adjustment due to Java overloading:
 *   - FormLayout.setHonorsVisibility(Component, Boolean) => setHonorsVisibilityForComponent(component, boolean)
 *   - FormSpec(DefaultAlignment, String) => omitted
 *   - ColumnSpec(Size) => omitted
 *   - ColumnSpec(EncodedDescription) => omitted; use ColumnSpec.decode(string)
 *   - CellConstraints(*) => use the string variant
 *   - RowSpec(EncodedDescription) => omitted; use RowSpec.decode(string)
 *
 * - I've removed anything to do with serialization
 *
 * - I eliminated these methods because JS' lack of packaging / namespaces made them unnecessary:
 *   - Sizes.dluX(int)
 *   - Sizes.dluY(int)
 *
 * - LayoutMap is not yet supported
 *
 * - FormLayout(String, String) => FormLayout.fromStrings(string, string)
 *
 * - FormLayout.layoutContainer(container) => FormLayout.layout(container)
 *
 * - xxxLayoutSize => getXXXSize() (e.g., minimumLayoutSize => getMinimumSize())
 */

//= require "../jshashtable"

if (typeof th.formlayout == "undefined") th.formlayout = {};

th.formlayout.Exception = Class.define({
    members: {
        init: function(message) {
            this.message = message;
        },

        toString: function() {
            return this.message;
        }
    }
});

th.formlayout.IllegalArgumentException = Class.define({
    superclass: th.formlayout.Exception,

    members: {
        init: function(message) {
            this._super(message);
        }
    }
});

th.formlayout.IndexOutOfBoundsException = Class.define({
    superclass: th.formlayout.Exception,

    members: {
        init: function(message) {
            this._super(message);
        }
    }
});

th.formlayout.FormLayoutParseException = Class.define({
    superclass: th.formlayout.Exception,

    members: {
        init: function(message) {
            this._super(message);
        }
    }
});

th.formlayout.Unit = Class.define({
    members: {
        init: function(name, abbreviation, parseAbbreviation, requiresIntegers) {
            this.name = name;
            this.abbreviation = abbreviation;
            this.parseAbbreviation = parseAbbreviation;
            this.requiresIntegers = requiresIntegers;
        },

        toString: function() {
            return this.name;
        },

        encode: function() {
            return this.parseAbbreviation || this.abbreviation;
        },

        abbreviation: function() {
            return this.abbreviation;
        }
    }
});

th.formlayout.Unit.valueOf = function(name, horizontal) {
    if (name.length == 0) {
        var defaultUnit = th.formlayout.Sizes.getDefaultUnit();
        if (defaultUnit) {
            return defaultUnit;
        }
        return horizontal ? th.formlayout.ConstantSize.DIALOG_UNITS_X : th.formlayout.ConstantSize.DIALOG_UNITS_Y;
    } else if (name == "px")
        return th.formlayout.ConstantSize.PIXEL;
    else if (name == "dlu")
        return horizontal ? th.formlayout.ConstantSize.DIALOG_UNITS_X : th.formlayout.ConstantSize.DIALOG_UNITS_Y;
    else if (name == "em")
        return th.formlayout.ConstantSize.EM;
    else if (name == "pt")
        return th.formlayout.ConstantSize.POINT;
    else if (name == "in")
        return th.formlayout.ConstantSize.INCH;
    else if (name == "mm")
        return th.formlayout.ConstantSize.MILLIMETER;
    else if (name == "cm")
        return th.formlayout.ConstantSize.CENTIMETER;
    else
        throw "Invalid unit name '" + name + "'. Must be one of: " +
            "px, dlu, pt, mm, cm, in";
}

th.formlayout.FormLayout = Class.define({
    members: {
        init: function(colSpecs, rowSpecs) {
            if (th.isString(colSpecs)) colSpecs = th.formlayout.ColumnSpec.decodeSpecs(colSpecs);
            if (th.isString(rowSpecs)) rowSpecs = th.formlayout.RowSpec.decodeSpecs(rowSpecs);

            this.colSpecs = colSpecs;
            this.rowSpecs = rowSpecs;

            this.colGroupIndices = [];
            this.rowGroupIndices = [];

            this.constraintMap = new th.Hashtable();
            this.componentSizeCache = new th.formlayout.ComponentSizeCache();

            var self = this;
            this.minimumWidthMeasure = function(c) {
                return self.componentSizeCache.getMinimumSize(c).width;
            };
            this.minimumHeightMeasure = function(c) {
                return self.componentSizeCache.getMinimumSize(c).height;
            };
            this.preferredWidthMeasure = function(c) {
                return self.componentSizeCache.getPreferredSize(c).width;
            };
            this.preferredHeightMeasure = function(c) { 
                return self.componentSizeCache.getPreferredSize(c).height;
            };
        },

        getColumnCount: function() {
            return this.colSpecs.length;
        },

        getColumnSpec: function(columnIndex) {
            return this.colSpecs[columnIndex - 1];
        },

        setColumnSpec: function(columnIndex, columnSpec) {
            this.colSpecs[columnIndex - 1] = columnSpec;
        },

        appendColumn: function(columnSpec) {
            this.colSpecs.push(columnSpec);
        },

        insertColumn: function(columnIndex, columnSpec) {
            if (columnIndex < 1 || columnIndex > this.getColumnCount()) {
                throw "The column index " + columnIndex +
                      "must be in the range [1, " + this.getColumnCount() + "].";
            }
            this.colSpecs[columnIndex - 1] =  columnSpec;
            this.shiftComponentsHorizontally(columnIndex, false);
            this.adjustGroupIndices(this.colGroupIndices, columnIndex, false);
        },

        removeColumn: function(columnIndex) {
            if (columnIndex < 1 || columnIndex > this.getColumnCount()) {
                throw "The column index " + columnIndex + " must be in the range [1, " + this.getColumnCount() + "].";
            }
            this.colSpecs.remove(columnIndex - 1);
            this.shiftComponentsHorizontally(columnIndex, true);
            this.adjustGroupIndices(this.colGroupIndices, columnIndex, true);
        },

        getRowCount: function() {
            return this.rowSpecs.length;
        },

        getRowSpec: function(rowIndex) {
            return this.rowSpecs[rowIndex - 1];
        },

        setRowSpec: function(rowIndex, rowSpec) {
            this.rowSpecs[rowIndex - 1] = rowSpec;
        },

        appendRow: function(rowSpec) {
            this.rowSpecs.push(rowSpec);
        },

        insertRow: function(rowIndex, rowSpec) {
            if (rowIndex < 1 || rowIndex > this.getRowCount()) {
                throw "The row index " + rowIndex +
                      " must be in the range [1, " + this.getRowCount() + "].";
            }
            this.rowSpecs.add(rowIndex - 1, rowSpec);
            this.shiftComponentsVertically(rowIndex, false);
            this.adjustGroupIndices(this.rowGroupIndices, rowIndex, false);
        },

        removeRow: function(rowIndex) {
            if (rowIndex < 1 || rowIndex > this.getRowCount()) {
                throw "The row index " + rowIndex +
                      "must be in the range [1, " + this.getRowCount() + "].";
            }
            this.rowSpecs.remove(rowIndex - 1);
            this.shiftComponentsVertically(rowIndex, true);
            this.adjustGroupIndices(this.rowGroupIndices, rowIndex, true);
        },

        shiftComponentsHorizontally: function(columnIndex, remove) {
            var offset = remove ? -1 : 1;

            var keys = this.constraintMap.keys();
            th.forEach(keys, function(key) {
                var constraints = this.constraintMap.get(key);
                var x1 = constraints.gridX;
                var w  = constraints.gridWidth;
                var x2 = x1 + w - 1;
                if (x1 == columnIndex && remove) {
                    throw "The removed column " + columnIndex +
                        " must not contain component origins.\n" +
                        "Illegal component=" + key;
                } else if (x1 >= columnIndex) {
                    constraints.gridX += offset;
                } else if (x2 >= columnIndex) {
                    constraints.gridWidth += offset;
                }
            });
        },

        shiftComponentsVertically: function(rowIndex, remove) {
            var offset = remove ? -1 : 1;
            var keys = this.constraintMap.keys();
            th.forEach(keys, function(key) {
                var constraints = this.constraintMap.get(key);
                var y1 = constraints.gridY;
                var h  = constraints.gridHeight;
                var y2 = y1 + h - 1;
                if (y1 == rowIndex && remove) {
                    throw "The removed row " + rowIndex +
                        " must not contain component origins.\n" +
                        "Illegal component=" + key;
                } else if (y1 >= rowIndex) {
                    constraints.gridY += offset;
                } else if (y2 >= rowIndex) {
                    constraints.gridHeight += offset;
                }
            });
        },

        adjustGroupIndices: function(allGroupIndices, modifiedIndex, remove) {
            var offset = remove ? -1 : +1;
            for (var group = 0; group < allGroupIndices.length; group++) {
                var groupIndices = allGroupIndices[group];
                for (var i = 0; i < groupIndices.length; i++) {
                    var index = groupIndices[i];
                    if (index == modifiedIndex && remove) {
                        throw "The removed index " + modifiedIndex + " must not be grouped.";
                    } else if (index >= modifiedIndex) {
                        groupIndices[i] += offset;
                    }
                }
            }
        },

        getConstraints: function(component) {
            return this.constraintMap.get(component);
        },

        setConstraints: function(component, constraints) {
            constraints.ensureValidGridBounds(this.getColumnCount(), this.getRowCount());
            this.constraintMap.put(component, constraints);
        },

        removeConstraints: function(component) {
            this.constraintMap.remove(component);
            this.componentSizeCache.removeEntry(component);
        },

        getColumnGroups: function() {
            return this.colGroupIndices;
        },

        setColumnGroups: function(colGroupIndices) {
            var maxColumn = this.getColumnCount();
            var usedIndices = [];
            for (var group = 0; group < this.colGroupIndices.length; group++) {
                for (var j = 0; j < this.colGroupIndices[group].length; j++) {
                    var colIndex = this.colGroupIndices[group][j];
                    if (colIndex < 1 || colIndex > maxColumn) {
                        throw "Invalid column group index " + colIndex +
                            " in group " + (group+1);
                    }
                    if (usedIndices[colIndex]) {
                        throw "Column index " + colIndex + " must not be used in multiple column groups.";
                    }
                    usedIndices[colIndex] = true;
                }
            }
            this.colGroupIndices = colGroupIndices;
        },

        addGroupedColumn: function(columnIndex) {
            var newColGroups = this.getColumnGroups();
            // Create a group if none exists.
            if (newColGroups.length == 0) {
                newColGroups = [0][ columnIndex ];
            } else {
                var lastGroupIndex = newColGroups.length - 1;
                var lastGroup = newColGroups[lastGroupIndex];
                var groupSize = lastGroup.length;
                var newLastGroup = lastGroup.slice(0, groupSize);
                newLastGroup[groupSize] = columnIndex;
                newColGroups[lastGroupIndex] = newLastGroup;
            }
            this.setColumnGroups(newColGroups);
        },

        getRowGroups: function() {
            return this.rowGroupIndices;
        },

        setRowGroups: function(rowGroupIndices) {
            var rowCount = this.getRowCount();
            var usedIndices = [];
            for (var i = 0; i < this.rowGroupIndices.length; i++) {
                for (var j = 0; j < this.rowGroupIndices[i].length; j++) {
                    var rowIndex = this.rowGroupIndices[i][j];
                    if (rowIndex < 1 || rowIndex > rowCount) {
                        throw "Invalid row group index " + rowIndex + " in group " + (i+1);
                    }
                    if (usedIndices[rowIndex]) {
                        throw "Row index " + rowIndex + " must not be used in multiple row groups.";
                    }
                    usedIndices[rowIndex] = true;
                }
            }
            this.rowGroupIndices = rowGroupIndices;
        },

        addGroupedRow: function(rowIndex) {
            var newRowGroups = this.getRowGroups();
            // Create a group if none exists.
            if (newRowGroups.length == 0) {
                newRowGroups = [0][ rowIndex ];
            } else {
                var lastGroupIndex = newRowGroups.length - 1;
                var lastGroup = newRowGroups[lastGroupIndex];
                var groupSize = lastGroup.length;
                var newLastGroup = lastGroup.slice(0, groupSize);
                newLastGroup[groupSize] = rowIndex;
                newRowGroups[lastGroupIndex] = newLastGroup;
            }
            this.setRowGroups(newRowGroups);
        },

        getHonorsVisibility: function() {
            return this.honorsVisibility;
        },

        setHonorsVisibility: function(b) {
            var oldHonorsVisibility = this.getHonorsVisibility();
            if (oldHonorsVisibility == b) return;
            this.honorsVisibility = b;

            var componentSet = this.constraintMap.keys();
            if (componentSet.length == 0) return;
            var firstComponent = componentSet[0];
            var container = firstComponent.parent;
            if (container) container.render();
        },

        setHonorsVisibilityForComponent: function(component, b) {
            var constraints = this.getConstraints(component);
            if (b == constraints.honorsVisibility) return;
            constraints.honorsVisibility = b;
            if (component.parent) component.parent.render();
        },

        addLayoutComponent: function(comp, constraints) {
            if (th.isString(constraints)) {
                this.setConstraints(comp, new th.formlayout.CellConstraints(constraints));
            } else {
                this.setConstraints(comp, constraints);
            }
        },

        removeLayoutComponent: function(comp) {
            this.removeConstraints(comp);
        },
        
        getMinimumSize: function(parent) {
            return this.computeLayoutSize(parent, this.minimumWidthMeasure, this.minimumHeightMeasure);
        },

        getPreferredSize: function(parent) {
            return this.computeLayoutSize(parent, this.preferredWidthMeasure, this.preferredHeightMeasure);
        },

        getMaximumSize: function(parent) {
            // todo: verify this is the right format for dimensions
            return { width: 1000000, height: 1000000 };
        },

        invalidateLayout: function(target) {
            this.invalidateCaches();
        },

        layout: function(/* Container */ parent) {
            this.initializeColAndRowComponentLists();
            var size = parent.getSize();

            var insets = parent.getInsets();
            var totalWidth  = size.width - insets.left - insets.right;
            var totalHeight = size.height- insets.top  - insets.bottom;

            var x = this.computeGridOrigins(parent,
                                         totalWidth, insets.left,
                                         this.colSpecs,
                                         this.colComponents,
                                         this.colGroupIndices,
                                         this.minimumWidthMeasure,
                                         this.preferredWidthMeasure
                                         );
            var y = this.computeGridOrigins(parent,
                                         totalHeight, insets.top,
                                         this.rowSpecs,
                                         this.rowComponents,
                                         this.rowGroupIndices,
                                         this.minimumHeightMeasure,
                                         this.preferredHeightMeasure
                                         );

            this.layoutComponents(x, y);
        },

        initializeColAndRowComponentLists: function() {
            this.colComponents = [];
            for (var i = 0; i < this.getColumnCount(); i++) {
                this.colComponents[i] = [];
            }

            this.rowComponents = [];
            for (var i = 0; i < this.getRowCount(); i++) {
                this.rowComponents[i] = [];
            }

            var keys = this.constraintMap.keys();
            th.forEach(keys, function(component) {
                var constraints = this.constraintMap.get(component);
                if (this.takeIntoAccount(component, constraints)) {
                    if (constraints.gridWidth == 1)
                        this.colComponents[constraints.gridX - 1].push(component);

                    if (constraints.gridHeight == 1)
                        this.rowComponents[constraints.gridY - 1].push(component);
                }
            }, this);
        },

        computeLayoutSize: function(parent, defaultWidthMeasure, defaultHeightMeasure) {
            this.initializeColAndRowComponentLists();
            var colWidths  = this.maximumSizes(parent, this.colSpecs, this.colComponents,
                                            this.minimumWidthMeasure,
                                            this.preferredWidthMeasure,
                                            defaultWidthMeasure);
            var rowHeights = this.maximumSizes(parent, this.rowSpecs, this.rowComponents,
                                            this.minimumHeightMeasure,
                                            this.preferredHeightMeasure,
                                            defaultHeightMeasure);
            var groupedWidths  = this.groupedSizes(this.colGroupIndices, colWidths);
            var groupedHeights = this.groupedSizes(this.rowGroupIndices, rowHeights);

            // Convert sizes to origins.
            var xOrigins = this.computeOrigins(groupedWidths,  0);
            var yOrigins = this.computeOrigins(groupedHeights, 0);

            var width1  = this.sum(groupedWidths);
            var height1 = this.sum(groupedHeights);
            var maxWidth = width1;
            var maxHeight = height1;

            /*
             * Take components that span multiple columns or rows into account.
             * This shall be done if and only if a component spans an interval
             * that can grow.
             */
            // First computes the maximum number of cols/rows a component
            // can span without spanning a growing column.
            var maxFixedSizeColsTable = this.computeMaximumFixedSpanTable(this.colSpecs);
            var maxFixedSizeRowsTable = this.computeMaximumFixedSpanTable(this.rowSpecs);

            var keys = this.constraintMap.keys();
            var self = this;
            th.forEach(keys, function(component) {
                var constraints = self.constraintMap.get(component);

                if (!self.takeIntoAccount(component, constraints)) return;

                if (   (constraints.gridWidth > 1)
                    && (constraints.gridWidth > maxFixedSizeColsTable[constraints.gridX-1])) {
                    //int compWidth = minimumWidthMeasure.sizeOf(component);
                    var compWidth = defaultWidthMeasure(component);
                    //int compWidth = preferredWidthMeasure.sizeOf(component);
                    var gridX1 = constraints.gridX-1;
                    var gridX2 = gridX1 + constraints.gridWidth;
                    var lead  = xOrigins[gridX1];
                    var trail = width1 - xOrigins[gridX2];
                    var myWidth = lead + compWidth + trail;
                    if (myWidth > maxWidth) {
                        maxWidth = myWidth;
                    }
                }

                if (   (constraints.gridHeight > 1)
                    && (constraints.gridHeight > maxFixedSizeRowsTable[constraints.gridY-1])) {
                    //int compHeight = minimumHeightMeasure.sizeOf(component);
                    var compHeight = defaultHeightMeasure(component);
                    //int compHeight = preferredHeightMeasure.sizeOf(component);
                    var gridY1 = constraints.gridY-1;
                    var gridY2 = gridY1 + constraints.gridHeight;
                    var lead  = yOrigins[gridY1];
                    var trail = height1 - yOrigins[gridY2];
                    var myHeight = lead + compHeight + trail;
                    if (myHeight > maxHeight) {
                        maxHeight = myHeight;
                    }
                }
            });
            var insets = parent.getInsets();
            var width  = maxWidth  + insets.left + insets.right;
            var height = maxHeight + insets.top  + insets.bottom;
            return { width: width, height: height };
        },

        computeGridOrigins: function(container, totalSize, offset, formSpecs, componentLists, groupIndices, minMeasure, prefMeasure) {
            /* For each spec compute the minimum and preferred size that is
             * the maximum of all component minimum and preferred sizes resp.
             */
            var minSizes   = this.maximumSizes(container, formSpecs, componentLists,
                                            minMeasure, prefMeasure, minMeasure);
            var prefSizes  = this.maximumSizes(container, formSpecs, componentLists,
                                            minMeasure, prefMeasure, prefMeasure);

            var groupedMinSizes  = this.groupedSizes(groupIndices, minSizes);
            var groupedPrefSizes = this.groupedSizes(groupIndices, prefSizes);
            var   totalMinSize     = this.sum(groupedMinSizes);
            var   totalPrefSize    = this.sum(groupedPrefSizes);
            var compressedSizes  = this.compressedSizes(formSpecs,
                                                   totalSize,
                                                   totalMinSize,
                                                   totalPrefSize,
                                                   groupedMinSizes,
                                                   prefSizes);
            var groupedSizes     = this.groupedSizes(groupIndices, compressedSizes);
            var   totalGroupedSize = this.sum(groupedSizes);
            var sizes            = this.distributedSizes(formSpecs,
                                                     totalSize,
                                                     totalGroupedSize,
                                                     groupedSizes);
            return this.computeOrigins(sizes, offset);
        },

        computeOrigins: function(sizes, offset) {
            var count = sizes.length;
            var origins = [];
            origins[0] = offset;
            for (var i = 1; i <= count; i++) {
                origins[i] = origins[i-1] + sizes[i-1];
            }
            return origins;
        },

        layoutComponents: function(x, y) {
            var keys = this.constraintMap.keys();
            th.forEach(keys, function(component) {
                var cellBounds = {};
                var constraints = this.constraintMap.get(component);
                var gridX      = constraints.gridX - 1;
                var gridY      = constraints.gridY - 1;
                var gridWidth  = constraints.gridWidth;
                var gridHeight = constraints.gridHeight;
                cellBounds.x = x[gridX];
                cellBounds.y = y[gridY];
                cellBounds.width  = x[gridX + gridWidth ] - cellBounds.x;
                cellBounds.height = y[gridY + gridHeight] - cellBounds.y;

                constraints.setBounds(component, this, cellBounds,
                                this.minimumWidthMeasure,   this.minimumHeightMeasure,
                                this.preferredWidthMeasure, this.preferredHeightMeasure);
            }, this);
        },

        invalidateCaches: function() {
            this.componentSizeCache.invalidate();
        },

        maximumSizes: function(container,
                                formSpecs,
                                componentLists,
                                minMeasure,
                                prefMeasure,
                                defaultMeasure) {
            var size = formSpecs.length;
            var result = [];
            for (var i = 0; i < size; i++) {
                var formSpec = formSpecs[i];
                result[i] = formSpec.maximumSize(container,
                                                 componentLists[i],
                                                 minMeasure,
                                                 prefMeasure,
                                                 defaultMeasure);
            }
            return result;
        },

        compressedSizes: function(formSpecs, totalSize, totalMinSize, totalPrefSize, minSizes, prefSizes) {

            // If we have less space than the total min size, answer the min sizes.
            if (totalSize < totalMinSize)
                return minSizes;
            // If we have more space than the total pref size, answer the pref sizes.
            if (totalSize >= totalPrefSize)
                return prefSizes;

            var count = formSpecs.length;
            var sizes = [];

            var totalCompressionSpace = totalPrefSize - totalSize;
            var maxCompressionSpace   = totalPrefSize - totalMinSize;
            var compressionFactor     = totalCompressionSpace / maxCompressionSpace;

    //      console("Total compression space=" + totalCompressionSpace);
    //      console("Max compression space  =" + maxCompressionSpace);
    //      console("Compression factor     =" + compressionFactor);

            for (var i=0; i < count; i++) {
                var formSpec = formSpecs[i];
                sizes[i] = prefSizes[i];
                if (formSpec.getSize().compressible()) {
                    sizes[i] -= Math.round((prefSizes[i] - minSizes[i]) * compressionFactor);
                }
            }
            return sizes;
        },

        groupedSizes: function(groups, rawSizes) {
            // Return the compressed sizes if there are no groups.
            if (!groups || groups.length == 0) {
                return rawSizes;
            }

            // Initialize the result with the given compressed sizes.
            var sizes = [];
            for (var i = 0; i < sizes.length; i++) {
                sizes[i] = rawSizes[i];
            }

            // For each group equalize the sizes.
            for (var group = 0; group < groups.length; group++) {
                var groupIndices = groups[group];
                var groupMaxSize = 0;
                // Compute the group's maximum size.
                for (var i = 0; i < groupIndices.length; i++) {
                    var index = groupIndices[i] - 1;
                    groupMaxSize = Math.max(groupMaxSize, sizes[index]);
                }
                // Set all sizes of this group to the group's maximum size.
                for (var i = 0; i < groupIndices.length; i++) {
                    var index = groupIndices[i] - 1;
                    sizes[index] = groupMaxSize;
                }
            }
            return sizes;
        },

        distributedSizes: function(formSpecs, totalSize, totalPrefSize, inputSizes) {
            var totalFreeSpace = totalSize - totalPrefSize;
            // Do nothing if there's no free space.
            if (totalFreeSpace < 0)
                return inputSizes;

            // Compute the total weight.
            var count = formSpecs.length;
            var totalWeight = 0.0;
            for (var i = 0; i < count; i++) {
                var formSpec = formSpecs[i];
                totalWeight += formSpec.getResizeWeight();
            }

            // Do nothing if there's no resizing column.
            if (totalWeight == 0.0)
                return inputSizes;

            var sizes = [];

            var restSpace = totalFreeSpace;
            var roundedRestSpace = parseInt(totalFreeSpace);
            for (var i = 0; i < count; i++) {
                var formSpec = formSpecs[i];
                var weight = formSpec.getResizeWeight();
                if (weight == th.formlayout.FormSpec.NO_GROW) {
                    sizes[i] = inputSizes[i];
                } else {
                    var roundingCorrection = restSpace - roundedRestSpace;
                    var extraSpace = totalFreeSpace * weight / totalWeight;
                    var correctedExtraSpace = extraSpace - roundingCorrection;
                    var roundedExtraSpace = Math.round(correctedExtraSpace);
                    sizes[i] = inputSizes[i] + roundedExtraSpace;
                    restSpace -= extraSpace;
                    roundedRestSpace -= roundedExtraSpace;
                }
            }
            return sizes;
        },

        computeMaximumFixedSpanTable: function(formSpecs) {
            var size = formSpecs.length;
            var table = [];
            var maximumFixedSpan = 1000000;        // Could be 1
            for (var i = size-1; i >= 0; i--) {
                var spec = formSpecs[i];
                if (spec.canGrow()) {
                    maximumFixedSpan = 0;
                }
                table[i] = maximumFixedSpan;
                if (maximumFixedSpan < 1000000)
                    maximumFixedSpan++;
            }
            return table;
        },

        sum: function(sizes) {
            var sum = 0;
            for (var i = sizes.length - 1; i >= 0; i--) {
                sum += sizes[i];
            }
            return sum;
        },

        takeIntoAccount: function(component, cc) {
            return   component.cssValue("visibility") != "hidden"
                  || ((!cc.honorsVisibility) && !this.getHonorsVisibility())
                  || !cc.honorsVisibility;
        },

        getLayoutInfo: function (parent) {
            this.initializeColAndRowComponentLists();
            var size = parent.getSize();
            var insets = parent.getInsets();
            var totalWidth = size.width - insets.left - insets.right;
            var totalHeight = size.height - insets.top - insets.bottom;
            var x = this.computeGridOrigins(parent,
                    totalWidth, insets.left,
                    this.colSpecs,
                    this.colComponents,
                    this.colGroupIndices,
                    this.minimumWidthMeasure,
                    this.preferredWidthMeasure);
            var y = this.computeGridOrigins(parent,
                    totalHeight, insets.top,
                    this.rowSpecs,
                    this.rowComponents,
                    this.rowGroupIndices,
                    this.minimumHeightMeasure,
                    this.preferredHeightMeasure);
            return new th.formlayout.LayoutInfo(x, y);
        }
    }
});

th.formlayout.LayoutInfo = Class.define({
    members: {
        init: function(xOrigins, yOrigins) {
            this.columnOrigins = xOrigins;
            this.rowOrigins = yOrigins;
        },

        getX: function () {
            return this.columnOrigins[0];
        },

        getY: function () {
            return this.rowOrigins[0];
        },

        getWidth: function () {
            return this.columnOrigins[this.columnOrigins.length - 1] - this.columnOrigins[0];
        },

        getHeight: function () {
            return this.rowOrigins[this.rowOrigins.length - 1] - this.rowOrigins[0];
        }
    }
});


th.formlayout.ComponentSizeCache = Class.define({
    members: {
        init: function() {
            this.minimumSizes = new th.Hashtable();
            this.preferredSizes = new th.Hashtable();
        },

        invalidate: function() {
            this.minimumSizes.clear();
            this.preferredSizes.clear();
        },

        getSize: function(component, hash, sizeType) {
            var size = hash.get(component);
            if (!size) {
                size = component[sizeType]();
                hash.put(component, size);
            }
            return size;

        },

        getMinimumSize: function(component) {
            return this.getSize(component, this.minimumSizes, "getMinimumSize");
        },

        getPreferredSize: function(component) {
            return this.getSize(component, this.preferredSizes, "getPreferredSize");
        },

        removeEntry: function(component) {
            this.minimumSizes.remove(component);
            this.preferredSizes.remove(component);
        }
    }
});

th.formlayout.FormSpec = Class.define({
    members: {
        NO_GROW: 0.0,

        DEFAULT_GROW: 1.0,

        spacer: false,

        init: function(defaultAlignment, size, resizeWeight) {
            this.defaultAlignment = defaultAlignment;
            this.size = size;
            this.resizeWeight = resizeWeight || 0;
        },

        isSpacer: function() {
            return this.spacer;
        },

        getDefaultAlignment: function() {
            return this.defaultAlignment;
        },

        getSize: function() {
            return this.size;
        },

        getResizeWeight: function() {
            return this.resizeWeight;
        },

        canGrow: function() {
            return this.resizeWeight != this.NO_GROW;
        },

        isHorizontal: function() {
            throw "This needs to be overridden.";
        },

        setDefaultAlignment: function(defaultAlignment) {
            this.defaultAlignment = defaultAlignment;
        },

        setSize: function(size) {
            this.size = size;
        },

        setResizeWeight: function(resizeWeight) {
            this.resizeWeight = resizeWeight;
        },

        maximumSize: function(container,
                        components,
                        minMeasure,
                        prefMeasure,
                        defaultMeasure) {
            return this.size.maximumSize(container,
                                     components,
                                     minMeasure,
                                     prefMeasure,
                                     defaultMeasure);
        },

        parseAndInitValues: function(encodedDescription) {
            // check if the spec is wrapped as a spacer
            if (encodedDescription.indexOf("spacer(") == 0) {
                encodedDescription = encodedDescription.substring("spacer(".length, encodedDescription.length - 1);
                this.spacer = true;
            }

            var token = encodedDescription.split(":");
            if (token.length == 0) {
                throw new th.formlayout.IllegalArgumentException(
                                        "The form spec must not be empty.");
            }
            var nextIndex = 0;
            var next = token[nextIndex++];

            // Check if the first token is an orientation.
            var alignment = th.formlayout.DefaultAlignment.valueOf(next, this.isHorizontal());
            if (alignment) {
                this.setDefaultAlignment(alignment);
                if (token.length == 1) {
                    throw new th.formlayout.IllegalArgumentException(
                                        "The form spec must provide a size.");
                }
                next = token[nextIndex++];
            }
            this.setSize(this.parseSize(next));
            if (nextIndex < token.length) {
                this.setResizeWeight(this.parseResizeWeight(token[nextIndex]));
            }

        },

        parseSize: function(token) {
            if (token.indexOf("[") == 0 && token.indexOf("]") == token.length - 1) {
                return this.parseBoundedSize(token);
            }
            if (token.indexOf("max(") == 0 && token.indexOf(")") == token.length - 1) {
                return this.parseOldBoundedSize(token, false);
            }
            if (token.indexOf("min(") == 0 && token.indexOf(")") == token.length - 1) {
                return this.parseOldBoundedSize(token, true);
            }
            return this.parseAtomicSize(token);
        },

        
        parseBoundedSize: function(token) {
            var content = token.substring(1, token.length - 1);
            var subtoken = content.split(/\s*,\s*/);
            var basis = undefined;
            var lower = undefined;
            var upper = undefined;
            if (subtoken.length == 2) {
                var size1 = this.parseAtomicSize(subtoken[0]);
                var size2 = this.parseAtomicSize(subtoken[1]);
                if (this.isConstant(size1)) {
                    if (this.isConstant(size2)) {
                        lower = size1;
                        basis = size2;
                        upper = size2;
                    } else {
                        lower = size1;
                        basis = size2;
                    }
                } else {
                    basis = size1;
                    upper = size2;
                }
            } else if (subtoken.length == 3) {
                lower = this.parseAtomicSize(subtoken[0]);
                basis = this.parseAtomicSize(subtoken[1]);
                upper = this.parseAtomicSize(subtoken[2]);
            }
            if (   ((lower == null) || (this.isConstant(lower)))
                && ((upper == null) || (this.isConstant(upper))))  {
                return new th.formlayout.BoundedSize(basis, lower, upper);
            }
            throw new th.formlayout.IllegalArgumentException(
                    "Illegal bounded size '" + token + "'. Must be one of:"
                  + "\n[<constant size>,<logical size>]                 // lower bound"
                  + "\n[<logical size>,<constant size>]                 // upper bound"
                  + "\n[<constant size>,<logical size>,<constant size>] // lower and upper bound."
                  + "\nExamples:"
                  + "\n[50dlu,pref]                                     // lower bound"
                  + "\n[pref,200dlu]                                    // upper bound"
                  + "\n[50dlu,pref,200dlu]                              // lower and upper bound."
                  );
        },

        parseAtomicSize: function(token) {
            var trimmedToken = th.trim(token);
            if (   trimmedToken.indexOf("'") == 0 && trimmedToken.indexOf("'") == trimmedToken.length - 1) {
                var length = trimmedToken.length;
                if (length < 2) {
                    throw new th.formlayout.IllegalArgumentException("Missing closing \"'\" for prototype.");
                }
                return new th.formlayout.PrototypeSize(trimmedToken.substring(1, length - 1));
            }
            var componentSize = th.formlayout.ComponentSize.valueOf(trimmedToken);
            if (componentSize != null)
                return componentSize;
            return th.formlayout.ConstantSize.valueOf(trimmedToken, this.isHorizontal());
        },

        parseResizeWeight: function(token) {
            if (token == "g" || token == "grow") {
                return th.formlayout.FormSpec.DEFAULT_GROW;
            }
            if (token == "n" || token == "nogrow" || token == "none") {
                return th.formlayout.FormSpec.NO_GROW;
            }
            // Must have format: grow(<double>)
            if ((token.indexOf("grow(") == 0 || token.indexOf("g(") == 0)
                 && token.indexOf(")") == token.length - 1) {
                var leftParen  = token.indexOf('(');
                var rightParen = token.indexOf(')');
                var substring = token.substring(leftParen + 1, rightParen);
                return parseFloat(substring);
            }
            throw new th.formlayout.IllegalArgumentException(
                        "The resize argument '" + token + "' is invalid. " +
                        " Must be one of: grow, g, none, n, grow(<double>), g(<double>)");
        },

        isConstant: function(aSize) {
            return  (aSize instanceof th.formlayout.ConstantSize)
                 || (aSize instanceof th.formlayout.PrototypeSize);
        },

        toString: function() {
            buffer = this.defaultAlignment;

            buffer += ":";
            buffer += this.size.toString();
            buffer += ':';
            if (this.resizeWeight == th.formlayout.FormSpec.NO_GROW) {
                buffer += "noGrow";
            } else if (this.resizeWeight == th.formlayout.FormSpec.DEFAULT_GROW) {
                buffer += "grow";
            } else {
                buffer += "grow(";
                buffer += this.resizeWeight;
                buffer += ')';
            }
            return buffer;
        },

        toShortString: function() {
            buffer = this.defaultAlignment.abbreviation();

            buffer += ":";
            buffer += this.size.toString();
            buffer += ':';
            if (this.resizeWeight == th.formlayout.FormSpec.NO_GROW) {
                buffer += "n";
            } else if (this.resizeWeight == th.formlayout.FormSpec.DEFAULT_GROW) {
                buffer += "g";
            } else {
                buffer += "g(";
                buffer += this.resizeWeight;
                buffer += ')';
            }
            return buffer;
        },

        encode: function() {
            var buffer = "";
            var alignmentDefault = this.isHorizontal()
                ? th.formlayout.ColumnSpec.DEFAULT
                : th.formlayout.RowSpec.DEFAULT;
            if (!alignmentDefault.equals(this.defaultAlignment)) {
                buffer += this.defaultAlignment.abbreviation();
                buffer += ":";
            }
            buffer += this.size.encode();
            if (this.resizeWeight == th.formlayout.FormSpec.NO_GROW) {
                // Omit the resize part
            } else if (this.resizeWeight == th.formlayout.FormSpec.DEFAULT_GROW) {
                buffer += ':';
                buffer += "g";
            } else {
                buffer += ':';
                buffer += "g(";
                buffer += this.resizeWeight;
                buffer += ')';
            }
            return buffer;
        }
    }
});

th.formlayout.DefaultAlignment = Class.define({
    members: {
        init: function(name) {
            this.name = name;
        },

        toString: function() {
            return this.name;
        },

        abbreviation: function() {
            return this.name.charAt(0);
        }
    }
});

th.formlayout.DefaultAlignment.valueOf = function(str, isHorizontal) {
    if (str == "f" || str == "fill")
        return th.formlayout.FormSpec.FILL_ALIGN;
    else if (str == "c" || str == "center")
        return th.formlayout.FormSpec.CENTER_ALIGN;
    else if (isHorizontal) {
        if (str == "r" || str == "right")
            return th.formlayout.FormSpec.RIGHT_ALIGN;
        else if (str == "l" || str == "left")
            return th.formlayout.FormSpec.LEFT_ALIGN;
        else
            return;
    } else {
        if (str == "t" || str == "top")
            return th.formlayout.FormSpec.TOP_ALIGN;
        else if (str == "b" || str == "bottom")
            return th.formlayout.FormSpec.BOTTOM_ALIGN;
        else
            return;
    }
}

th.formlayout.FormSpec.LEFT_ALIGN = new th.formlayout.DefaultAlignment("left");
th.formlayout.FormSpec.RIGHT_ALIGN = new th.formlayout.DefaultAlignment("right");
th.formlayout.FormSpec.TOP_ALIGN = new th.formlayout.DefaultAlignment("top");
th.formlayout.FormSpec.BOTTOM_ALIGN = new th.formlayout.DefaultAlignment("bottom");
th.formlayout.FormSpec.CENTER_ALIGN = new th.formlayout.DefaultAlignment("center");
th.formlayout.FormSpec.FILL_ALIGN = new th.formlayout.DefaultAlignment("fill");

th.formlayout.ColumnSpec = Class.define({
    superclass: th.formlayout.FormSpec,

    members: {
        init: function(defaultAlignment, size, resizeWeight) {
            this._super(defaultAlignment, size, resizeWeight);
        },

        isHorizontal: function() {
            return true;
        }
    }
});

th.formlayout.ColumnSpec.decode = function(encodedColumnSpec, layoutMap) {
    var trimmed = th.trim(encodedColumnSpec);
    var lower = trimmed.toLowerCase();
    return th.formlayout.ColumnSpec.decodeExpanded(lower);
}

th.formlayout.ColumnSpec.decodeExpanded = function(expandedTrimmedLowerCaseSpec) {
    var spec = th.formlayout.ColumnSpec.CACHE.get(expandedTrimmedLowerCaseSpec);
    if (!spec) {
        spec = new th.formlayout.ColumnSpec(th.formlayout.ColumnSpec.DEFAULT, th.formlayout.Sizes.DEFAULT, th.formlayout.FormSpec.NO_GROW);
        spec.parseAndInitValues(expandedTrimmedLowerCaseSpec);
        th.formlayout.ColumnSpec.CACHE.put(expandedTrimmedLowerCaseSpec, spec);
    }
    return spec;
};

th.formlayout.ColumnSpec.decodeSpecs = function(encodedColumnSpecs, layoutMap) {
    return th.formlayout.FormSpecParser.parseColumnSpecs(encodedColumnSpecs, layoutMap);
}

th.formlayout.ColumnSpec.createGap = function(gapHeight) {
    return new th.formlayout.RowSpec(th.formlayout.ColumnSpec.DEFAULT, gapHeight, th.formlayout.ColumnSpec.NO_GROW);
}

th.formlayout.ColumnSpec.LEFT = th.formlayout.FormSpec.LEFT_ALIGN;
th.formlayout.ColumnSpec.CENTER = th.formlayout.FormSpec.CENTER_ALIGN;
th.formlayout.ColumnSpec.MIDDLE = th.formlayout.ColumnSpec.CENTER;
th.formlayout.ColumnSpec.RIGHT = th.formlayout.FormSpec.RIGHT_ALIGN;
th.formlayout.ColumnSpec.FILL = th.formlayout.FormSpec.FILL_ALIGN;
th.formlayout.ColumnSpec.DEFAULT = th.formlayout.ColumnSpec.FILL;

th.formlayout.ColumnSpec.CACHE = new th.Hashtable();

th.formlayout.RowSpec = Class.define({
    superclass: th.formlayout.FormSpec,

    members: {
        init: function(defaultAlignment, size, resizeWeight) {
            this._super(defaultAlignment, size, resizeWeight);
        },

        isHorizontal: function() {
            return false;
        }
    }
});

th.formlayout.RowSpec.decode = function(encodedRowSpec, layoutMap) {
    var trimmed = th.trim(encodedRowSpec);
    var lower = trimmed.toLowerCase();
    return th.formlayout.RowSpec.decodeExpanded(lower);
}

th.formlayout.RowSpec.decodeExpanded = function(expandedTrimmedLowerCaseSpec) {
    var spec = th.formlayout.RowSpec.CACHE.get(expandedTrimmedLowerCaseSpec);
    if (!spec) {
        spec = new th.formlayout.RowSpec(th.formlayout.RowSpec.DEFAULT, th.formlayout.Sizes.DEFAULT, th.formlayout.FormSpec.NO_GROW);
        spec.parseAndInitValues(expandedTrimmedLowerCaseSpec);
        th.formlayout.RowSpec.CACHE.put(expandedTrimmedLowerCaseSpec, spec);
    }
    return spec;
};

th.formlayout.RowSpec.decodeSpecs = function(encodedRowSpecs, layoutMap) {
    return th.formlayout.FormSpecParser.parseRowSpecs(encodedRowSpecs, layoutMap);
}

th.formlayout.RowSpec.createGap = function(gapHeight) {
    return new th.formlayout.RowSpec(th.formlayout.RowSpec.DEFAULT, gapHeight, th.formlayout.RowSpec.NO_GROW); 
}

th.formlayout.RowSpec.TOP = th.formlayout.FormSpec.TOP_ALIGN;
th.formlayout.RowSpec.CENTER = th.formlayout.FormSpec.CENTER_ALIGN;
th.formlayout.RowSpec.BOTTOM = th.formlayout.FormSpec.BOTTOM_ALIGN;
th.formlayout.RowSpec.FILL = th.formlayout.FormSpec.FILL_ALIGN;
th.formlayout.RowSpec.DEFAULT = th.formlayout.RowSpec.CENTER;

th.formlayout.RowSpec.CACHE = new th.Hashtable();

th.formlayout.BoundedSize = Class.define({
    members: {
        // takes three Size arguments
        init: function(basis, lowerBound, upperBound) {
            this.basis = basis;
            this.lowerBound = lowerBound;
            this.upperBound = upperBound;
        },

        getBasis: function() {
            return this.basis;
        },

        getLowerBound: function() {
            return this.lowerBound;
        },

        getUpperBound: function() {
            return this.upperBound;
        },

        maximumSize: function(container, components, minMeasure, prefMeasure, defaultMeasure) {
            var size = this.basis.maximumSize(container, components, minMeasure, prefMeasure, defaultMeasure);

            if (this.lowerBound) {
                size = Math.max(size,
                                this.lowerBound.maximumSize(
                                        container,
                                        components,
                                        minMeasure,
                                        prefMeasure,
                                        defaultMeasure));
            }

            if (this.upperBound) {
                size = Math.min(size,
                                this.upperBound.maximumSize(
                                        container,
                                        components,
                                        minMeasure,
                                        prefMeasure,
                                        defaultMeasure));
            }

            return size;
        },

        compressible: function() {
            return this.basis.compressible();
        },

        equals: function(object) {
            if (this === object)
                return true;
            var size = object;
            return this.basis.equals(size.basis)
                 && (   (this.lowerBound == null && size.lowerBound == null)
                     || (this.lowerBound != null && this.lowerBound.equals(size.lowerBound)))
                 && (   (this.upperBound == null && size.upperBound == null)
                     || (this.upperBound != null && this.upperBound.equals(size.upperBound)));

        },

        hashCode: function() {
            var hashValue = this.basis.hashCode();
            if (this.lowerBound) {
                hashValue = hashValue * 37 + this.lowerBound.hashCode();
            }
            if (this.upperBound) {
                hashValue = hashValue * 37 + this.upperBound.hashCode();
            }
            return hashValue;
        }
    }
});

th.formlayout.ConstantSize = Class.define({
    members: {
        init: function(value, unit) {
            this.value = value;
            this.unit = unit;
        },

        getValue: function() {
            return this.value;
        },

        getUnit: function() {
            return this.unit;
        },

        getPixelSize: function(component) {
            if (this.unit == th.formlayout.ConstantSize.PIXEL)
                return this.intValue();
            else if (this.unit == th.formlayout.ConstantSize.EM)
                return th.formlayout.Sizes.emAsPixel(this.value, component);
            else if (this.unit == th.formlayout.ConstantSize.POINT)
                return th.formlayout.Sizes.pointAsPixel(this.intValue(), component);
            else if (this.unit == th.formlayout.ConstantSize.INCH)
                return th.formlayout.Sizes.inchAsPixel(this.value, component);
            else if (this.unit == th.formlayout.ConstantSize.MILLIMETER)
                return th.formlayout.Sizes.millimeterAsPixel(this.value, component);
            else if (this.unit == th.formlayout.ConstantSize.CENTIMETER)
                return th.formlayout.Sizes.centimeterAsPixel(this.value, component);
            else if (this.unit == th.formlayout.ConstantSize.DIALOG_UNITS_X)
                return th.formlayout.Sizes.dialogUnitXAsPixel(this.intValue(), component);
            else if (this.unit == th.formlayout.ConstantSize.DIALOG_UNITS_Y)
                return th.formlayout.Sizes.dialogUnitYAsPixel(this.intValue(), component);
            else
                throw "Invalid unit " + this.unit;
        },

        maximumSize: function(container, components, minMeasure, prefMeasure, defaultMeasure) {
            return this.getPixelSize(container);
        },

        compressible: function() {
            return false;
        },

        equals: function(o) {
            if (this == o)
                return true;
            if (!(o instanceof th.formlayout.ConstantSize))
                return false;
            var size = o;
            return this.value == size.value
                 && this.unit  == size.unit;
        },

        hashCode: function() {
            return this.value + 37 * this.unit.hashCode();
        },

        toString: function() {
            return this.value + unit.abbreviation();
        },

        encode: function() {
            return this.value + unit.encode();
        },

        intValue: function() {
            return Math.round(this.value);
        }
    }
});

th.formlayout.ConstantSize.valueOf = function(encodedValueAndUnit, horizontal) {
    var split = th.formlayout.ConstantSize.splitValueAndUnit(encodedValueAndUnit);
    var encodedValue = split[0];
    var encodedUnit  = split[1];
    var unit = th.formlayout.Unit.valueOf(encodedUnit, horizontal);
    var value = parseFloat(encodedValue);
    if (unit.requiresIntegers) {
        if (value != parseInt(value))
            throw unit.toString()
                + " value " + encodedValue + " must be an integer.";
    }
    return new th.formlayout.ConstantSize(value, unit);
};

th.formlayout.ConstantSize.dluX = function(value) {
    return new th.formlayout.ConstantSize(value, th.formlayout.ConstantSize.DLUX);
};

th.formlayout.ConstantSize.dluY = function(value) {
    return new th.formlayout.ConstantSize(value, th.formlayout.ConstantSize.DLUY);
};

th.formlayout.ConstantSize.splitValueAndUnit = function(encodedValueAndUnit) {
    var result = [];
    var len = encodedValueAndUnit.length;
    var firstLetterIndex = len;
    while (firstLetterIndex > 0
            && (! /[^a-zA-Z]/.test(encodedValueAndUnit.charAt(firstLetterIndex-1)))) {
            firstLetterIndex--;
    }
    result[0] = encodedValueAndUnit.substring(0, firstLetterIndex);
    result[1] = encodedValueAndUnit.substring(firstLetterIndex);
    return result;
};

th.formlayout.ConstantSize.PIXEL = new th.formlayout.Unit("Pixel", "px", undefined, true);
th.formlayout.ConstantSize.EM = new th.formlayout.Unit("Em", "em", undefined, false);
th.formlayout.ConstantSize.POINT = new th.formlayout.Unit("Point", "pt", undefined, false);
th.formlayout.ConstantSize.DIALOG_UNITS_X = new th.formlayout.Unit("Dialog units X", "dluX", "dlu", true);
th.formlayout.ConstantSize.DIALOG_UNITS_Y = new th.formlayout.Unit("Dialog units Y", "dluY", "dlu", true);
th.formlayout.ConstantSize.MILLIMETER = new th.formlayout.Unit("Millimeter", "mm", undefined, false);
th.formlayout.ConstantSize.CENTIMETER = new th.formlayout.Unit("Centimeter", "cm", undefined, false);
th.formlayout.ConstantSize.INCH = new th.formlayout.Unit("Inch", "in", undefined, false);

th.formlayout.ConstantSize.PX = th.formlayout.ConstantSize.PIXEL;
th.formlayout.ConstantSize.PT = th.formlayout.ConstantSize.POINT;
th.formlayout.ConstantSize.DLUX = th.formlayout.ConstantSize.DIALOG_UNITS_X;
th.formlayout.ConstantSize.DLUY = th.formlayout.ConstantSize.DIALOG_UNITS_Y;
th.formlayout.ConstantSize.MM = th.formlayout.ConstantSize.MILLIMETER;
th.formlayout.ConstantSize.CM = th.formlayout.ConstantSize.CENTIMETER;
th.formlayout.ConstantSize.IN = th.formlayout.ConstantSize.INCH;

th.formlayout.PrototypeSize = Class.define({
    members: {
        init: function(prototype) {
            this.proto = prototype;
        },

        getPrototype: function() {
            return this.proto;
        },

        maximumSize: function(container, components, minMeasure, prefMeasure, defaultMeasure) {
            throw "PrototypeSize.maximumSize() not yet implemented";

//            Font font = DefaultUnitConverter.getInstance().getDefaultDialogFont();
//            FontMetrics fm = container.getFontMetrics(font);
//            return fm.stringWidth(getPrototype());
        },

        compressible: function() {
            return false;
        },

        encode: function() {
            return "'" + this.proto + "'";
        },

        equals: function(o) {
            if (this == o)
                return true;
            if (!(o instanceof th.formlayout.PrototypeSize))
                return false;
            return this.proto == o.proto;
        },

        toString: function() {
            return this.encode();
        }
    }
});

th.formlayout.ComponentSize = Class.define({
    members: {
        init: function(name) {
            this.name = name;
        },

        maximumSize: function(
            container,
            components,
            minMeasure,
            prefMeasure,
            defaultMeasure) {

            var measure = this == th.formlayout.Sizes.MINIMUM
                    ? minMeasure
                    : (this == th.formlayout.Sizes.PREFERRED ? prefMeasure : defaultMeasure);
            var maximum = 0;
            for (var i = 0; i < components.length; i++) {
                var c = components[i];
                maximum = Math.max(maximum, measure(c));
            }
            return maximum;
        },

        compressible: function() {
            return this == th.formlayout.Sizes.DEFAULT;
        },

        toString: function() {
            return this.encode();
        },

        encode: function() {
            return name.substring(0, 1);
        }
    }
});

th.formlayout.ComponentSize.valueOf = function(str) {
    if (str == "m" || str == "min")
        return th.formlayout.Sizes.MINIMUM;
    if (str == "p" || str == "pref")
        return th.formlayout.Sizes.PREFERRED;
    if (str == "d" || str == "default")
        return th.formlayout.Sizes.DEFAULT;
    return;
}

th.formlayout.DefaultUnitConverter = Class.define({
    members: {
        inchAsPixel: function(inch, component) {
            return th.convertAbsoluteUnitToPixels("in", inch);
        },

        millimeterAsPixel: function(mm, component) {
            return th.convertAbsoluteUnitToPixels("mm", mm);
        },

        centimeterAsPixel: function(cm, component) {
            return th.convertAbsoluteUnitToPixels("cm", cm);
        },

        pointAsPixel: function(pt, component) {
            return th.convertAbsoluteUnitToPixels("pt", pt);
        },

        emAsPixel: function(em, component) {
            return th.convertEmToPixels(component.cssValue("font"), em);
        },

        dialogUnitXAsPixel: function(dluX, component) {
            throw "Unsupported";
        },

        dialogUnitYAsPixel: function(dluY, component) {
            throw "Unsupported";
        }
    }
});

th.formlayout.Sizes = {};

th.formlayout.Sizes.unitConverter = new th.formlayout.DefaultUnitConverter();

th.formlayout.Sizes.pixel = function(value) {
    return new th.formlayout.ConstantSize(value, th.formlayout.ConstantSize.PIXEL);
}

th.formlayout.Sizes.ZERO = th.formlayout.Sizes.pixel(0);

th.formlayout.Sizes.DLUX1 = th.formlayout.ConstantSize.dluX(1);
th.formlayout.Sizes.DLUX2 = th.formlayout.ConstantSize.dluX(2);
th.formlayout.Sizes.DLUX3 = th.formlayout.ConstantSize.dluX(3);
th.formlayout.Sizes.DLUX4 = th.formlayout.ConstantSize.dluX(4);
th.formlayout.Sizes.DLUX5 = th.formlayout.ConstantSize.dluX(5);
th.formlayout.Sizes.DLUX6 = th.formlayout.ConstantSize.dluX(6);
th.formlayout.Sizes.DLUX7 = th.formlayout.ConstantSize.dluX(7);
th.formlayout.Sizes.DLUX8 = th.formlayout.ConstantSize.dluX(8);
th.formlayout.Sizes.DLUX9 = th.formlayout.ConstantSize.dluX(9);
th.formlayout.Sizes.DLUX11 = th.formlayout.ConstantSize.dluX(11);
th.formlayout.Sizes.DLUX14 = th.formlayout.ConstantSize.dluX(14);
th.formlayout.Sizes.DLUX21 = th.formlayout.ConstantSize.dluX(21);

th.formlayout.Sizes.DLUY1 = th.formlayout.ConstantSize.dluY(1);
th.formlayout.Sizes.DLUY2 = th.formlayout.ConstantSize.dluY(2);
th.formlayout.Sizes.DLUY3 = th.formlayout.ConstantSize.dluY(3);
th.formlayout.Sizes.DLUY4 = th.formlayout.ConstantSize.dluY(4);
th.formlayout.Sizes.DLUY5 = th.formlayout.ConstantSize.dluY(5);
th.formlayout.Sizes.DLUY6 = th.formlayout.ConstantSize.dluY(6);
th.formlayout.Sizes.DLUY7 = th.formlayout.ConstantSize.dluY(7);
th.formlayout.Sizes.DLUY8 = th.formlayout.ConstantSize.dluY(8);
th.formlayout.Sizes.DLUY9 = th.formlayout.ConstantSize.dluY(9);
th.formlayout.Sizes.DLUY11 = th.formlayout.ConstantSize.dluY(11);
th.formlayout.Sizes.DLUY14 = th.formlayout.ConstantSize.dluY(14);
th.formlayout.Sizes.DLUY21 = th.formlayout.ConstantSize.dluY(21);

th.formlayout.Sizes.MINIMUM = new th.formlayout.ComponentSize("minimum");
th.formlayout.Sizes.PREFERRED = new th.formlayout.ComponentSize("preferred");
th.formlayout.Sizes.DEFAULT = new th.formlayout.ComponentSize("default");
th.formlayout.Sizes.defaultUnit = th.formlayout.ConstantSize.PIXEL;

th.formlayout.Sizes.constant = function(encodedValueAndUnit, horizontal) {
    var lowerCase = encodedValueAndUnit.toLowerCase();
    var trimmed = th.trim(lowerCase);
    return th.formlayout.ConstantSize.valueOf(trimmed, horizontal);
}

th.formlayout.Sizes.bounded = function(basis, lowerBound, upperBound) {
    return th.formlayout.BoundedSize(basis, lowerBound, upperBound); 
}

th.formlayout.Sizes.emAsPixel = function(em, component) {
    return em == 0 ? 0 : th.formlayout.Sizes.unitConverter.emAsPixel(em, component);
}

th.formlayout.Sizes.inchAsPixel = function(inch, component) {
    return inch == 0 ? 0 : th.formlayout.Sizes.unitConverter.inchAsPixel(inch, component);
}

th.formlayout.Sizes.millimeterAsPixel = function(mm, component) {
    return mm == 0 ? 0 : th.formlayout.Sizes.unitConverter.millimeterAsPixel(mm, component);
}

th.formlayout.Sizes.centimeterAsPixel = function(cm, component) {
    return cm == 0 ? 0 : th.formlayout.Sizes.unitConverter.centimeterAsPixel(cm, component);
}

th.formlayout.Sizes.pointAsPixel = function(pt, component) {
    return pt == 0 ? 0 : th.formlayout.Sizes.unitConverter.pointAsPixel(pt, component);
}

th.formlayout.Sizes.dialogUnitXAsPixel = function(dluX, component) {
    return dluX == 0 ? 0 : th.formlayout.Sizes.unitConverter.dialogUnitXAsPixel(dluX, component);
}

th.formlayout.Sizes.dialogUnitYAsPixel = function(dluY, component) {
    return dluY == 0 ? 0 : th.formlayout.Sizes.unitConverter.dialogUnitYAsPixel(dluY, component);
}

th.formlayout.Sizes.getDefaultUnit = function() {
    return th.formlayout.Sizes.defaultUnit;
}

th.formlayout.Alignment = Class.define({
    members: {
        init: function(name, orientation) {
            this.name = name;
            this.orientation = orientation;
        },

        toString: function() {
            return this.name;
        },

        abbreviation: function() {
            return this.name.charAt(0);
        },

        isHorizontal: function() {
            return this.orientation != th.formlayout.Alignment.VERTICAL;
        },

        isVertical: function() {
            return this.orientation != th.formlayout.Alignment.HORIZONTAL;
        }
    }
});

th.formlayout.Alignment.HORIZONTAL = 0;
th.formlayout.Alignment.VERTICAL = 1;
th.formlayout.Alignment.BOTH = 2;

th.formlayout.Alignment.valueOf = function(nameOrAbbreviation) {
    var str = nameOrAbbreviation.toLowerCase();
    if (str == "d" || str == "default")
        return th.formlayout.CellConstraints.DEFAULT;
    else if (str == "f" || str == "fill")
        return th.formlayout.CellConstraints.FILL;
    else if (str == "c" || str == "center")
        return th.formlayout.CellConstraints.CENTER;
    else if (str == "l" || str == "left")
        return th.formlayout.CellConstraints.LEFT;
    else if (str == "r" || str == "right")
        return th.formlayout.CellConstraints.RIGHT;
    else if (str == "t" || str == "top")
        return th.formlayout.CellConstraints.TOP;
    else if (str == "b" || str == "bottom")
        return th.formlayout.CellConstraints.BOTTOM;
    else
        throw "Invalid alignment " + nameOrAbbreviation
            + ". Must be one of: left, center, right, top, bottom, "
            + "fill, default, l, c, r, t, b, f, d.";

}

th.formlayout.CellConstraints = Class.define({
    members: {
        init: function(gridX, gridY, gridWidth, gridHeight, hAlign, vAlign, insets) {
            var encodedConstraints = undefined;
            if (th.isString(gridX)) {
                encodedConstraints = gridX;
                delete gridX;
            }

            this.gridX = (gridX == undefined) ? 1 : gridX;
            this.gridY = (gridY == undefined) ? 1 : gridY;
            this.gridWidth = (gridWidth == undefined) ? 1 : gridWidth;
            this.gridHeight = (gridHeight == undefined) ? 1 : gridHeight;
            this.hAlign = hAlign || th.formlayout.CellConstraints.DEFAULT;
            this.vAlign = vAlign || th.formlayout.CellConstraints.DEFAULT;
            this.insets = insets || th.formlayout.CellConstraints.EMPTY_INSETS;

            if (this.gridX <= 0)
                throw new th.formlayout.IndexOutOfBoundsException("The grid x must be a positive number.");
            if (this.gridY <= 0)
                throw new th.formlayout.IndexOutOfBoundsException("The grid y must be a positive number.");
            if (this.gridWidth <= 0)
                throw new th.formlayout.IndexOutOfBoundsException("The grid width must be a positive number.");
            if (this.gridHeight <= 0)
                throw new th.formlayout.IndexOutOfBoundsException("The grid height must be a positive number.");
            this.ensureValidOrientations(this.hAlign, this.vAlign);

            if (encodedConstraints) {
                this.initFromConstraints(encodedConstraints);
            }
        },

        ensureValidOrientations: function(horizontalAlignment, verticalAlignment) {
            if (!horizontalAlignment.isHorizontal())
                throw new th.formlayout.IllegalArgumentException("The horizontal alignment must be one of: left, center, right, fill, default.");
            if (!verticalAlignment.isVertical())
                throw new th.formlayout.IllegalArgumentException("The vertical alignment must be one of: top, center, botto, fill, default.");
        },

        initFromConstraints: function(encodedConstraints) {
            var tokens = encodedConstraints.split(",");
            var argCount = tokens.length;
            if (!(argCount == 2 || argCount == 4 || argCount == 6))
               throw new th.formlayout.IllegalArgumentException(
                        "You must provide 2, 4 or 6 arguments.");

            var currentToken = 0;
            var nextInt = parseInt(th.trim(tokens[currentToken++]));
            if (!nextInt) {
                throw new th.formlayout.IllegalArgumentException(
                        "First cell constraint element must be a number.");
            }
            this.gridX = nextInt;
            if (this.gridX <= 0)
                throw new th.formlayout.IndexOutOfBoundsException("The grid x must be a positive number.");

            nextInt = parseInt(th.trim(tokens[currentToken++]));
            if (!nextInt) {
                throw new th.formlayout.IllegalArgumentException(
                        "Second cell constraint element must be a number.");
            }
            this.gridY = nextInt;
            if (this.gridY <= 0)
                throw new th.formlayout.IndexOutOfBoundsException(
                        "The grid y must be a positive number.");

            if (currentToken >= tokens.length)
                return;

            var token = th.trim(tokens[currentToken++]);
            nextInt = parseInt(token);
            if (nextInt) {
                // Case: "x, y, w, h" or
                //       "x, y, w, h, hAlign, vAlign"
                this.gridWidth = nextInt;
                if (this.gridWidth <= 0)
                    throw new th.formlayout.IndexOutOfBoundsException(
                        "The grid width must be a positive number.");
                nextInt = parseInt(th.trim(tokens[currentToken++]));
                if (nextInt == null)
                    throw new th.formlayout.IllegalArgumentException(
                        "Fourth cell constraint element must be like third.");
                this.gridHeight = nextInt;
                if (this.gridHeight <= 0)
                    throw new th.formlayout.IndexOutOfBoundsException(
                        "The grid height must be a positive number.");

                if (currentToken >= tokens.length)
                    return;
                token = th.trim(tokens[currentToken++]);
            }

            this.hAlign = this.decodeAlignment(token);
            this.vAlign = this.decodeAlignment(th.trim(tokens[currentToken++]));
            this.ensureValidOrientations(this.hAlign, this.vAlign);
        },

        ensureValidGridBounds: function(colCount, rowCount) {
            if (this.gridX <= 0) {
                throw new th.formlayout.IndexOutOfBoundsException(
                    "The column index " + this.gridX + " must be positive.");
            }
            if (this.gridX > colCount) {
                throw new th.formlayout.IndexOutOfBoundsException(
                    "The column index " + this.gridX + " must be less than or equal to "
                        + colCount + ".");
            }
            if (this.gridX + this.gridWidth - 1 > colCount) {
                throw new th.formlayout.IndexOutOfBoundsException(
                    "The grid width " + this.gridWidth + " must be less than or equal to "
                        + (colCount - this.gridX + 1) + ".");
            }
            if (this.gridY <= 0) {
                throw new th.formlayout.IndexOutOfBoundsException(
                    "The row index " + this.gridY + " must be positive.");
            }
            if (this.gridY > rowCount) {
                throw new th.formlayout.IndexOutOfBoundsException(
                    "The row index " + this.gridY + " must be less than or equal to "
                        + rowCount + ".");
            }
            if (this.gridY + this.gridHeight - 1 > rowCount) {
                throw new th.formlayout.IndexOutOfBoundsException(
                    "The grid height " + this.gridHeight + " must be less than or equal to "
                        + (rowCount - this.gridY + 1) + ".");
            }
        },

        decodeAlignment: function(encodedAlignment) {
            return th.formlayout.Alignment.valueOf(encodedAlignment);
        },

        setBounds: function(c, layout,
                       cellBounds,
                       minWidthMeasure,
                       minHeightMeasure,
                       prefWidthMeasure,
                       prefHeightMeasure) {
            var colSpec = this.gridWidth  == 1 ? layout.getColumnSpec(this.gridX) : undefined;
            var rowSpec = this.gridHeight == 1 ? layout.getRowSpec(this.gridY) : undefined;
            var concreteHAlign = this.concreteAlignment(this.hAlign, colSpec);
            var concreteVAlign = this.concreteAlignment(this.vAlign, rowSpec);
            var concreteInsets = this.insets ? this.insets : th.formlayout.CellConstraints.EMPTY_INSETS;
            var cellX = cellBounds.x + concreteInsets.left;
            var cellY = cellBounds.y + concreteInsets.top;
            var cellW = cellBounds.width  - concreteInsets.left - concreteInsets.right;
            var cellH = cellBounds.height - concreteInsets.top  - concreteInsets.bottom;
            var compW = this.componentSize(c, colSpec, cellW, minWidthMeasure,
                                                         prefWidthMeasure);
            var compH = this.componentSize(c, rowSpec, cellH, minHeightMeasure,
                                                         prefHeightMeasure);
            var x = this.origin(concreteHAlign, cellX, cellW, compW);
            var y = this.origin(concreteVAlign, cellY, cellH, compH);
            var w = this.extent(concreteHAlign, cellW, compW);
            var h = this.extent(concreteVAlign, cellH, compH);
            c.setBounds(x, y, w, h);
        },

        concreteAlignment: function(cellAlignment, formSpec) {
            return !formSpec
                ? (cellAlignment == th.formlayout.CellConstraints.DEFAULT ? th.formlayout.CellConstraints.FILL : cellAlignment)
                : this.usedAlignment(cellAlignment, formSpec);
        },

        usedAlignment: function(cellAlignment, formSpec) {
            if (cellAlignment != th.formlayout.CellConstraints.DEFAULT) {
                // Cell alignments other than DEFAULT override col/row alignments
                return cellAlignment;
            }
            var defaultAlignment = formSpec.getDefaultAlignment();
            if (defaultAlignment == th.formlayout.FormSpec.FILL_ALIGN)
                return th.formlayout.CellConstraints.FILL;
            if (defaultAlignment == th.formlayout.ColumnSpec.LEFT)
                return th.formlayout.CellConstraints.LEFT;
            else if (defaultAlignment == th.formlayout.FormSpec.CENTER_ALIGN)
                return th.formlayout.CellConstraints.CENTER;
            else if (defaultAlignment == th.formlayout.ColumnSpec.RIGHT)
                return th.formlayout.CellConstraints.RIGHT;
            else if (defaultAlignment == th.formlayout.RowSpec.TOP)
                return th.formlayout.CellConstraints.TOP;
            else
                return th.formlayout.CellConstraints.BOTTOM;
        },

        componentSize: function(component,
                                   formSpec,
                                   cellSize,
                                   minMeasure,
                                   prefMeasure) {
            if (!formSpec) {
                return prefMeasure(component);
            } else if (formSpec.getSize() == th.formlayout.Sizes.MINIMUM) {
                return minMeasure(component);
            } else if (formSpec.getSize() == th.formlayout.Sizes.PREFERRED) {
                return prefMeasure(component);
            } else {  // default mode
                return Math.min(cellSize, prefMeasure(component));
            }
        },

        origin: function(alignment, cellOrigin, cellSize, componentSize) {
            if (alignment == th.formlayout.CellConstraints.RIGHT || alignment == th.formlayout.CellConstraints.BOTTOM) {
                return cellOrigin + cellSize - componentSize;
            } else if (alignment == th.formlayout.CellConstraints.CENTER) {
                return cellOrigin + (cellSize - componentSize) / 2;
            } else {  // left, top, fill
                return cellOrigin;
            }
        },

        extent: function(alignment, cellSize, componentSize) {
            return alignment == th.formlayout.CellConstraints.FILL
                        ? cellSize
                        : componentSize;
        },
        
        toString: function() {
            var buffer = "CellConstraints";
            buffer += "[x=";
            buffer += this.gridX;
            buffer += "; y=";
            buffer += this.gridY;
            buffer += "; w=";
            buffer += this.gridWidth;
            buffer += "; h=";
            buffer += this.gridHeight;
            buffer += "; hAlign=";
            buffer += this.hAlign;
            buffer += "; vAlign=";
            buffer += this.vAlign;
//            if (!(th.formlayout.CellConstraints.EMPTY_INSETS.equals(insets))) {
//              buffer += "; insets=";
//              buffer += insets;
//            }
            buffer += "; honorsVisibility=";
            buffer += this.honorsVisibility;

            buffer += ']';
            return buffer;
        },

        xy: function () {
            var args = arguments;
            switch (arguments.length) {
                case 2:
                    return this.xywh(args[0], args[1], 1, 1);
                case 3:
                    return this.xywh(args[0], args[1], 1, 1, args[2]);
                case 4:
                    return this.xywh(args[0], args[1], 1, 1, args[2], args[3]);
                default:
                    throw "wrong number of arguments passed to xy()";
            }
        },

        xyw: function () {
            var args = arguments;
            switch (arguments.length) {
                case 3:
                    return this.xywh(args[0], args[1], args[2], 1, th.formlayout.CellConstraints.DEFAULT, th.formlayout.CellConstraints.DEFAULT);
                case 4:
                    return this.xywh(args[0], args[1], args[2], 1, args[3]);
                case 5:
                    return this.xywh(args[0], args[1], args[2], 1, args[3], args[4]);
                default:
                    throw "wrong number of arguments passed to xyw()";
            }
        },

        xywh: function () {
            var args = arguments;
            switch (arguments.length) {
                case 4:
                    return this.xywh(args[0], args[1], args[2], args[3], th.formlayout.CellConstraints.DEFAULT, th.formlayout.CellConstraints.DEFAULT);
                case 5:
                    var result = this.xywh(args[0], args[1], args[2], args[3]);
                    result.setAlignment(args[4], true);
                    return result;
                case 6:
                    this.gridX = args[0];
                    this.gridY = args[1];
                    this.gridWidth = args[2];
                    this.gridHeight = args[3];
                    this.hAlign = args[4];
                    this.vAlign = args[5];
                    this.ensureValidOrientations(this.hAlign, this.vAlign);
                    return this;
                default:
                    throw "wrong number of arguments passed to xywh()";
            }
        }
    }
});

th.formlayout.CellConstraints.DEFAULT = new th.formlayout.Alignment("default", th.formlayout.Alignment.BOTH);
th.formlayout.CellConstraints.FILL = new th.formlayout.Alignment("fill", th.formlayout.Alignment.BOTH);
th.formlayout.CellConstraints.LEFT = new th.formlayout.Alignment("left", th.formlayout.Alignment.HORIZONTAL);
th.formlayout.CellConstraints.RIGHT = new th.formlayout.Alignment("right", th.formlayout.Alignment.HORIZONTAL);
th.formlayout.CellConstraints.CENTER = new th.formlayout.Alignment("center", th.formlayout.Alignment.BOTH);
th.formlayout.CellConstraints.TOP = new th.formlayout.Alignment("top", th.formlayout.Alignment.VERTICAL);
th.formlayout.CellConstraints.BOTTOM = new th.formlayout.Alignment("bottom", th.formlayout.Alignment.VERTICAL);

th.formlayout.CellConstraints.EMPTY_INSETS = { top: 0, left: 0, bottom: 0, right: 0 };

th.formlayout.FormSpecParser = Class.define({
    members: {
        init: function(source, description, layoutMap, horizontal) {
            this.layoutMap = layoutMap;
            //this.source = this.layoutMap.expand(source, horizontal);
            this.source = source;   // fixme: variables not yet supported
        },

        parseColumnSpecs: function() {
            var encodedColumnSpecs = this.split(this.source, 0);
            var columnCount = encodedColumnSpecs.length;
            var columnSpecs = [];
            for (var i = 0; i < columnCount; i++) {
                var encodedSpec = encodedColumnSpecs[i];
                columnSpecs[i] = th.formlayout.ColumnSpec.decodeExpanded(encodedSpec);
            }
            return columnSpecs;
        },

        parseRowSpecs: function() {
            var encodedRowSpecs = this.split(this.source, 0);
            var rowCount = encodedRowSpecs.length;
            var rowSpecs = [];
            for (var i = 0; i < rowCount; i++) {
                var encodedSpec = encodedRowSpecs[i];
                rowSpecs[i] = th.formlayout.RowSpec.decodeExpanded(encodedSpec);
            }
            return rowSpecs;
        },

        split: function(expression, offset) {
            var encodedSpecs = [];
            var parenthesisLevel = 0;  // number of open '('
            var bracketLevel = 0;      // number of open '['
            var length = expression.length;
            var specStart = 0;
            var c;
            var lead = true;
            for (var i = 0; i < length; i++) {
                c = expression.charAt(i);
                if (lead && th.isWhitespace(c)) {
                    specStart++;
                    continue;
                }
                lead = false;
                if ((c == ',') && (parenthesisLevel == 0) && (bracketLevel == 0)) {
                    var token = expression.substring(specStart, i);
                    this.addSpec(encodedSpecs, token, offset + specStart);
                    specStart = i + 1;
                    lead = true;
                } else if (c == '(') {
                    if (bracketLevel > 0) {
                        this.fail(offset + i, "illegal '(' in [...]");
                    }
                    parenthesisLevel++;
                } else if (c == ')') {
                    if (bracketLevel > 0) {
                        this.fail(offset + i, "illegal ')' in [...]");
                    }
                    parenthesisLevel--;
                    if (parenthesisLevel < 0) {
                        this.fail(offset + i, "missing '('");
                    }
                } else if (c == '[') {
                    if (bracketLevel > 0) {
                        this.fail(offset + i, "too many '['");
                    }
                    bracketLevel++;
                } else if (c == ']') {
                    bracketLevel--;
                    if (bracketLevel < 0) {
                        this.fail(offset + i, "missing '['");
                    }
                }
            }
            if (parenthesisLevel > 0) {
                this.fail(offset + length, "missing ')'");
            }
            if (bracketLevel > 0) {
                this.fail(offset + length, "missing ']");
            }
            if (specStart < length) {
                var token = expression.substring(specStart);
                this.addSpec(encodedSpecs, token, offset + specStart);
            }
            return encodedSpecs;

        },

        addSpec: function(encodedSpecs, expression, offset) {
            var trimmedExpression = th.trim(expression);
            var multiplier = this.multiplier(trimmedExpression, offset);
            if (!multiplier) {
                encodedSpecs.push(trimmedExpression);
                return;
            }
            var subTokenList = this.split(multiplier.expression, offset + multiplier.offset);
            for (var i = 0; i < multiplier.multiplier; i++) {
                th.forEach(subTokenList, function(token) {
                    encodedSpecs.push(token);
                });
            }
        },

        multiplier: function(expression, offset) {
            var matcher = new RegExp(th.formlayout.FormSpecParser.MULTIPLIER_PREFIX_PATTERN);
            if (!matcher.test(expression)) {
                return;
            }

            var matcherResults = matcher.exec(expression);
            matcherResults.end = matcherResults.index + matcherResults[0].length;
            if (matcherResults.index > 0) {
                this.fail(offset + matcherResults.index, "illegal multiplier position");
            }

            
            var digitMatcher = new RegExp(th.formlayout.DIGIT_PATTERN);
            if (!digitMatcher.test(expression)) {
                return;
            }

            var digitResults = digitMatcher.exec(expression);
            digitResults.end = matcherResults.index + matcherResults[0].length;
            var digitStr = expression.substring(0, digitResults.end);
            var number = parseInt(digitStr);
            if (isNaN(number)) {
                this.fail(offset, "Invalid multiplier");
            }
            if (number <= 0) {
                this.fail(offset, "illegal 0 multiplier");
            }
            var subexpression = expression.substring(matcherResults.end, expression.length() - 1);
            return { multiplier: number, expression: subexpression, offset: matcherResults.end };
        },

        fail: function(index, description, source) {
            if (!source) source = this.source;
            throw new th.formlayout.FormLayoutParseException(this.message(source, index, description));
        },

        message: function(source, index, description) {
            var buffer = "\n";
            buffer += '\n';
            buffer += source;
            buffer += '\n';
            for (var i = 0; i < index; i++) {
                buffer += ' ';
            }
            buffer += '^';
            buffer += description;
            return buffer;
        }
    }
});

th.formlayout.FormSpecParser.parseColumnSpecs = function(encodedColumnSpecs, layoutMap) {
    var parser = new th.formlayout.FormSpecParser(
            encodedColumnSpecs,
            "encoded column specifications",
            layoutMap,
            true);
    return parser.parseColumnSpecs();
}

th.formlayout.FormSpecParser.parseRowSpecs = function(encodedRowSpecs, layoutMap) {
    var parser = new th.formlayout.FormSpecParser(
            encodedRowSpecs,
            "encoded column specifications",
            layoutMap,
            false);
    return parser.parseRowSpecs();
}

th.formlayout.FormSpecParser.MULTIPLIER_PREFIX_PATTERN = "\\d+\\s*\\*\\s*\\(";
th.formlayout.FormSpecParser.DIGIT_PATTERN = "\\d+";
