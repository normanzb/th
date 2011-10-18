th.Dimension = Class.define({
    members: {
        init: function () {
            if (arguments.length == 0) {
                this.width = 0;
                this.height = 0;
            } else if (arguments.length == 1) {
                var D = arguments[0];

                this.width = D.getWidth();
                this.height = D.getHeight();
            } else if (arguments.length == 2) {
                var width = arguments[0];
                var height = arguments[1];

                this.width = width;
                this.height = height;
            }
        },

        getWidth: function () {
            return this.width;
        },

        getHeight: function () {
            return this.height;
        },

        getSize: function () {
            return new th.Dimension(this.width, this.height);
        },

        setSize: function () {
            if (arguments.length == 1) {
                var D = arguments[0];

                this.width = D.getWidth();
                this.height = D.getHeight();
            } else if (arguments.length == 2) {
                var width = arguments[0];
                var height = arguments[1];

                this.width = width;
                this.height = height;
            }
        },

        equals: function (o) {
            if (o instanceof Dimension) {
                return this.width == o.width && this.height == o.height;
            }
            return false;
        }
    }
});

th.TestComponent = Class.define({
    superclass: th.Panel,

    type: "TestComponent",

    members: {
        init: function (params) {
            this._super(params);
            var sizes = /^(\d+)\,(\d+)\,(\d+)\,(\d+)$/.exec(params.sizes);
            var minWidth = Number(sizes[1]);
            var minHeight = Number(sizes[2]);
            var prefWidth = Number(sizes[3]);
            var prefHeight = Number(sizes[4]);

            this.minimumSize = new th.Dimension(minWidth, minHeight);
            this.preferredSize = new th.Dimension(prefWidth, prefHeight);
        },

        getMinimumSize: function () {
            return this.minimumSize;
        },

        getPreferredSize: function () {
            return this.preferredSize;
        }
    }
});

function assertEquals(label, expected, actual) {
    if (expected != actual) {
        fireunit.ok(false, label + " mismatch: expected=" + expected + "; actual=" + actual);
    } else {
        fireunit.ok(true, "Passed! (" + label + ")");
    }
}

function testBasic() {
    var scene = new th.Scene(document.getElementById("testBasic"), "../../src/");

    var layout = new th.formlayout.FormLayout(
            "1px, 2px, 3px, 5px, 7px",
            "1px, 2px, 3px"
    );

    scene.root.layout = function() {
        layout.layoutContainer(this);
    }
                        
    scene.root.layout();
    var info = layout.getLayoutInfo(scene.root);
    assertEquals("Columns",   6, info.columnOrigins.length);
    assertEquals("Rows",      4, info.rowOrigins.length);
    assertEquals("Column 0",  0, info.columnOrigins[0]);
    assertEquals("Column 1",  1, info.columnOrigins[1]);
    assertEquals("Column 2",  3, info.columnOrigins[2]);
    assertEquals("Column 3",  6, info.columnOrigins[3]);
    assertEquals("Column 4", 11, info.columnOrigins[4]);
    assertEquals("Column 5", 18, info.columnOrigins[5]);
}

function testHorizontalAlignments() {
    var scene = new th.Scene(document.getElementById("testHorizontalAlignments"), "../../src/");

    var left = scene.root.children[0];
    var center = scene.root.children[1];
    var right = scene.root.children[2];
    var fill = scene.root.children[3];
    var def = scene.root.children[4];

    var layout = new th.formlayout.FormLayout(
        "left:10px, center:10px, right:10px, fill:10px, 10px",
        "pref"
    );

    th.forEach(scene.root.children, function(component) {
        layout.addLayoutComponent(component, new th.formlayout.CellConstraints(component.layoutdata));
    });

    scene.root.layout = function() {
        layout.layoutContainer(this);
    }
                        
    scene.root.layout();

    assertEquals("Left.x",         0, /*left.getX()*/       left.d().b.x);
    assertEquals("Left.width",     4, /*left.getWidth()*/   left.d().b.w);
    assertEquals("Center.x",      13, /*center.getX()*/     center.d().b.x);
    assertEquals("Center.width",   4, /*center.getWidth()*/ center.d().b.w);
    assertEquals("Right.x",       26, /*right.getX()*/      right.d().b.x);
    assertEquals("Right.width",    4, /*right.getWidth()*/  right.d().b.w);
    assertEquals("Fill.x",        30, /*fill.getX()*/       fill.d().b.x);
    assertEquals("Fill.width",    10, /*fill.getWidth()*/   fill.d().b.w);
    assertEquals("Default.x",     40, /*def.getX()*/        def.d().b.x);
    assertEquals("Default.width", 10, /*def.getWidth()*/    def.d().b.w);
}

function testVerticalAlignments() {
    var scene = new th.Scene(document.getElementById("testVerticalAlignments"), "../../src/");

    var top = scene.root.children[0];
    var center = scene.root.children[1];
    var bottom = scene.root.children[2];
    var fill = scene.root.children[3];
    var def = scene.root.children[4];

    var layout = new th.formlayout.FormLayout(
            "pref",
            "top:10px, center:10px, bottom:10px, fill:10px, 10px"
    );

    th.forEach(scene.root.children, function(component) {
        layout.addLayoutComponent(component, new th.formlayout.CellConstraints(component.layoutdata));
    });

    scene.root.layout = function() {
        layout.layoutContainer(this);
    }
                        
    scene.root.layout();

    assertEquals("Top.y",           0, /*top.getY()*/           top.d().b.y);
    assertEquals("Top.height",      4, /*top.getHeight()*/      top.d().b.h);
    assertEquals("Center.y",       13, /*center.getY()*/        center.d().b.y);
    assertEquals("Center.height",   4, /*center.getHeight()*/   center.d().b.h);
    assertEquals("Bottom.y",       26, /*bottom.getY()*/        bottom.d().b.y);
    assertEquals("Bottom.height",   4, /*bottom.getHeight()*/   bottom.d().b.h);
    assertEquals("Fill.y",         30, /*fill.getY()*/          fill.d().b.y);
    assertEquals("Fill.height",    10, /*fill.getHeight()*/     fill.d().b.h);
    assertEquals("Default.y",      43, /*def.getY()*/           def.d().b.y);
    assertEquals("Default.height",  4, /*def.getHeight()*/      def.d().b.h);
}

function testBoundedWidth() {
    var scene = new th.Scene(document.getElementById("testBoundedWidth"), "../../src/");

    var c1 = scene.root.children[0];
    var c2 = scene.root.children[1];
    var c3 = scene.root.children[2];
    var c4 = scene.root.children[3];
    var c5 = scene.root.children[4];
    var c6 = scene.root.children[5];
    var c7 = scene.root.children[6];
    var c8 = scene.root.children[7];

    var layout = new th.formlayout.FormLayout(
            "[10px,min],  [10px,min],  " +
            "[10px,pref], [10px,pref], " +
            "[min,10px],  [min,10px],  " +
            "[pref,10px], [pref,10px]",
            "pref"
    );

    th.forEach(scene.root.children, function(component) {
        layout.addLayoutComponent(component, new th.formlayout.CellConstraints(component.layoutdata));
    });

    scene.root.layout = function() {
        layout.layoutContainer(this);
    }
                        
    scene.root.layout();

    assertEquals("max(10px;c1_min).width",   10, c1.d().b.w);
    assertEquals("max(10px;c2_min).width",   20, c2.d().b.w);
    assertEquals("max(10px;c3_pref).width",  10, c3.d().b.w);
    assertEquals("max(10px;c4_pref).width",  40, c4.d().b.w);
    assertEquals("min(10px;c5_min).width",    2, c5.d().b.w);
    assertEquals("min(10px;c6_min).width",   10, c6.d().b.w);
    assertEquals("min(10px;c7_pref).width",   4, c7.d().b.w);
    assertEquals("min(10px;c8_pref).width",  10, c8.d().b.w);
}

function testBoundedHeight() {
    var scene = new th.Scene(document.getElementById("testBoundedHeight"), "../../src/");

    var c1 = scene.root.children[0];
    var c2 = scene.root.children[1];
    var c3 = scene.root.children[2];
    var c4 = scene.root.children[3];
    var c5 = scene.root.children[4];
    var c6 = scene.root.children[5];
    var c7 = scene.root.children[6];
    var c8 = scene.root.children[7];

    var layout = new th.formlayout.FormLayout(
            "pref",
            "f:[10px,min],  f:[10px,min],  " +
            "f:[10px,pref], f:[10px,pref], " +
            "f:[min,10px],  f:[min,10px],  " +
            "f:[pref,10px], f:[pref,10px]"
    );

    th.forEach(scene.root.children, function(component) {
        layout.addLayoutComponent(component, new th.formlayout.CellConstraints(component.layoutdata));
    });

    scene.root.layout = function() {
        layout.layoutContainer(this);
    }
                        
    scene.root.layout();

    assertEquals("[10px, c1_min].height",  10, c1.d().b.h);
    assertEquals("[10px, c2_min].height",  20, c2.d().b.h);
    assertEquals("[10px,c3_pref].height",  10, c3.d().b.h);
    assertEquals("[10px,c4_pref].height",  40, c4.d().b.h);
    assertEquals("[c5_min, 10px].height",   2, c5.d().b.h);
    assertEquals("[c6_min, 10px].height",  10, c6.d().b.h);
    assertEquals("[c7_pref,10px].height",   4, c7.d().b.h);
    assertEquals("[c8_pref,10px].height",  10, c8.d().b.h);
}

function testNoExtraExpansionIfAllColumnsAreFixed() {
    var scene = new th.Scene(document.getElementById("testNoExtraExpansionIfAllColumnsAreFixed"), "../../src/");

    var c1 = scene.root.children[0];
    var c2 = scene.root.children[1];
    var c3 = scene.root.children[2];
    var c4 = scene.root.children[3]; // XXX: Had to change the layoutdata to match the constructor of CellConstraints. "1,2,2"->"1,2,2,1".
    
    var layout = new th.formlayout.FormLayout(
        "10px, 15px, 20px",
        "pref, pref"
    );

    var preferredLayoutSize = layout.preferredLayoutSize(scene.root);

    scene.root.bounds.width = preferredLayoutSize.width;
    scene.root.bounds.height = preferredLayoutSize.height;

    th.forEach(scene.root.children, function(component) {
        layout.addLayoutComponent(component, new th.formlayout.CellConstraints(component.layoutdata));
    });

    scene.root.layout = function() {
        layout.layoutContainer(this);
    }
                        
    scene.root.layout();

    var col1And2Width = c2.d().b.x + c2.d().b.w;
    var gridWidth     = c3.d().b.x + c3.d().b.w;
    var totalWidth    = preferredLayoutSize.width;

    assertEquals("Col1+2 width", 25, col1And2Width);
    assertEquals("Grid width",   45, gridWidth);
    assertEquals("Total width",  45, totalWidth);
}

function testNoExtraExpansionIfSpannedColumnsAreFixed() {
    var scene = new th.Scene(document.getElementById("testNoExtraExpansionIfAllColumnsAreFixed"), "../../src/");

    var c1 = scene.root.children[0];
    var c2 = scene.root.children[1];
    var c3 = scene.root.children[2];
    var c4 = scene.root.children[3]; // XXX: Had to change the layoutdata to match the constructor of CellConstraints. "1,2,2"->"1,2,2,1".

    var layout = new th.formlayout.FormLayout(
        "10px, 15px, 20px:grow",
        "pref, pref"
    );

    var preferredLayoutSize = layout.preferredLayoutSize(scene.root);

    scene.root.bounds.width = preferredLayoutSize.width;
    scene.root.bounds.height = preferredLayoutSize.height;

    th.forEach(scene.root.children, function(component) {
        layout.addLayoutComponent(component, new th.formlayout.CellConstraints(component.layoutdata));
    });

    scene.root.layout = function() {
        layout.layoutContainer(this);
    }
                        
    scene.root.layout();

    var col1And2Width = c2.d().b.x + c2.d().b.w;
    var gridWidth     = c3.d().b.x + c3.d().b.w;
    var totalWidth    = preferredLayoutSize.width;

    assertEquals("Col1+2 width",  25, col1And2Width);
    assertEquals("Grid width",    45, gridWidth);
    assertEquals("Total width",   45, totalWidth); // 70 is wrong
}

function testExtraExpansionIfSpannedColumnsGrow() {
    var scene = new th.Scene(document.getElementById("testExtraExpansionIfSpannedColumnsGrow"), "../../src/");

    var c1 = scene.root.children[0];
    var c2 = scene.root.children[1];
    var c3 = scene.root.children[2];
    var c4 = scene.root.children[3]; // XXX: Had to change the layoutdata to match the constructor of CellConstraints. "1,2,2"->"1,2,2,1".

    var layout = new th.formlayout.FormLayout(
        "10px, 15px:grow, 20px",
        "pref, pref"
    );

    var preferredLayoutSize = layout.preferredLayoutSize(scene.root);

    scene.root.bounds.width = preferredLayoutSize.width;
    scene.root.bounds.height = preferredLayoutSize.height;

    th.forEach(scene.root.children, function(component) {
        layout.addLayoutComponent(component, new th.formlayout.CellConstraints(component.layoutdata));
    });

    scene.root.layout = function() {
        layout.layoutContainer(this);
    }
                        
    scene.root.layout();

    var col1And2Width = c2.d().b.x + c2.d().b.w;
    var gridWidth     = c3.d().b.x + c3.d().b.w;
    var totalWidth    = preferredLayoutSize.width;

    assertEquals("Col1+2 width",  50, col1And2Width);
    assertEquals("Grid width",    70, gridWidth);
    assertEquals("Total width",   70, totalWidth);
}

function testExtraExpansionHonorsCurrentMeasure() {
    var scene = new th.Scene(document.getElementById("testExtraExpansionHonorsCurrentMeasure"), "../../src/");

    var c1 = scene.root.children[0];
    var c2 = scene.root.children[1];
    var c3 = scene.root.children[2];
    var c4 = scene.root.children[3]; // XXX: Had to change the layoutdata to match the constructor of CellConstraints. "1,2,2"->"1,2,2,1".

    var layout = new th.formlayout.FormLayout(
        "10px, 15px:grow, 20px",
        "pref, pref"
    );

    th.forEach(scene.root.children, function(component) {
        layout.addLayoutComponent(component, new th.formlayout.CellConstraints(component.layoutdata));
    });

    scene.root.layout = function() {
        layout.layoutContainer(this);
    }
                        
    scene.root.layout();

    var minimumLayoutWidth   = layout.minimumLayoutSize(scene.root).width;
    var preferredLayoutWidth = layout.preferredLayoutSize(scene.root).width;

    assertEquals("Minimum layout width",   45, minimumLayoutWidth);
    assertEquals("Preferred layout width", 70, preferredLayoutWidth);
}

function testDefaultSize() {
    var scene = new th.Scene(document.getElementById("testDefaultSize"), "../../src/");

    var c1 = scene.root.children[0];
    var layout = new th.formlayout.FormLayout(
        "default",
        "default"
    );

    th.forEach(scene.root.children, function(component) {
        layout.addLayoutComponent(component, new th.formlayout.CellConstraints(component.layoutdata));
    });

    scene.root.layout = function() {
        layout.layoutContainer(this);
    }

    var minimumLayoutSize    = layout.minimumLayoutSize(scene.root);
    var preferredLayoutSize  = layout.preferredLayoutSize(scene.root);
    assertEquals("Minimum layout width", 10, minimumLayoutSize.width);
    assertEquals("Minimum layout height", 10, minimumLayoutSize.height);
    assertEquals("Preferred layout width",  50, preferredLayoutSize.width);
    assertEquals("Preferred layout height", 50, preferredLayoutSize.height);

//    scene.root.setSize(minimumLayoutSize);
    scene.root.bounds.width = minimumLayoutSize.width;
    scene.root.bounds.height = minimumLayoutSize.height;
    scene.root.layout();
    var columnWidth = c1.d().b.w;
    var rowHeight = c1.d().b.h;
    assertEquals("Column width (container min)", 10, columnWidth);
    assertEquals("Row height (container min)", 10, rowHeight);

//    scene.root.setSize(preferredLayoutSize);
    scene.root.bounds.width = preferredLayoutSize.width;
    scene.root.bounds.height = preferredLayoutSize.height;
    scene.root.layout();
    columnWidth = c1.d().b.w;
    rowHeight = c1.d().b.h;
    assertEquals("Column width (container pref)", 50, columnWidth);
    assertEquals("Row height (container pref)", 50, rowHeight);
}

function testDefaultWithLowerBound() {
    var scene = new th.Scene(document.getElementById("testDefaultWithLowerBound"), "../../src/");

    var c1 = scene.root.children[0];
    var layout = new th.formlayout.FormLayout(
        "[20px,default]",
        "[20px,default]"
    );

    th.forEach(scene.root.children, function(component) {
        layout.addLayoutComponent(component, new th.formlayout.CellConstraints(component.layoutdata));
    });

    scene.root.layout = function() {
        layout.layoutContainer(this);
    }

    var minimumLayoutSize    = layout.minimumLayoutSize(scene.root);
    var preferredLayoutSize  = layout.preferredLayoutSize(scene.root);
    assertEquals("Minimum layout width", 20, minimumLayoutSize.width);
    assertEquals("Minimum layout height", 20, minimumLayoutSize.height);
    assertEquals("Preferred layout width",  50, preferredLayoutSize.width);
    assertEquals("Preferred layout height", 50, preferredLayoutSize.height);

//    scene.root.setSize(minimumLayoutSize);
    scene.root.bounds.width = minimumLayoutSize.width;
    scene.root.bounds.height = minimumLayoutSize.height;
    scene.root.layout();
    var columnWidth = c1.d().b.w;
    var rowHeight = c1.d().b.h;
    assertEquals("Column width (container min)", 20, columnWidth);
    assertEquals("Row height (container min)", 20, rowHeight);

//    scene.root.setSize(preferredLayoutSize);
    scene.root.bounds.width = preferredLayoutSize.width;
    scene.root.bounds.height = preferredLayoutSize.height;
    scene.root.layout();
    columnWidth = c1.d().b.w;
    rowHeight = c1.d().b.h;
    assertEquals("Column width (container pref)", 50, columnWidth);
    assertEquals("Row height (container pref)", 50, rowHeight);
}

function testDefaultWithUpperBound() {
    var scene = new th.Scene(document.getElementById("testDefaultWithUpperBound"), "../../src/");

    var c1 = scene.root.children[0];
    var layout = new th.formlayout.FormLayout(
        "[default,20px]",
        "[default,20px]"
    );

    th.forEach(scene.root.children, function(component) {
        layout.addLayoutComponent(component, new th.formlayout.CellConstraints(component.layoutdata));
    });

    scene.root.layout = function() {
        layout.layoutContainer(this);
    }

    var minimumLayoutSize    = layout.minimumLayoutSize(scene.root);
    var preferredLayoutSize  = layout.preferredLayoutSize(scene.root);
    assertEquals("Minimum layout width", 10, minimumLayoutSize.width);
    assertEquals("Minimum layout height", 10, minimumLayoutSize.height);
    assertEquals("Preferred layout width",  20, preferredLayoutSize.width);
    assertEquals("Preferred layout height", 20, preferredLayoutSize.height);

//    scene.root.setSize(minimumLayoutSize);
    scene.root.bounds.width = minimumLayoutSize.width;
    scene.root.bounds.height = minimumLayoutSize.height;
    scene.root.layout();
    var columnWidth = c1.d().b.w;
    var rowHeight = c1.d().b.h;
    assertEquals("Column width (container min)", 10, columnWidth);
    assertEquals("Row height (container min)", 10, rowHeight);

//    scene.root.setSize(preferredLayoutSize);
    scene.root.bounds.width = preferredLayoutSize.width;
    scene.root.bounds.height = preferredLayoutSize.height;
    scene.root.layout();
    columnWidth = c1.d().b.w;
    rowHeight = c1.d().b.h;
    assertEquals("Column width (container pref)", 20, columnWidth);
    assertEquals("Row height (container pref)", 20, rowHeight);
}

function testVisibility() {
    var scene = new th.Scene(document.getElementById("testVisibility"), "../../src/");
    _testVisibility(scene.root, true);
    _testVisibility(scene.root, false);
}


function _testVisibility(panel, containerHonorsVisibility) {
    var visible = panel.children[0];
    var invisible = panel.children[1];
//    invisible.setVisible(false);
    invisible.styles.display = "none";
    var invisibleHonorsVisibility = panel.children[2];
//    invisibleHonorsVisibility.setVisible(false);
    invisibleHonorsVisibility.styles.display = "none";
    var invisibleIgnoresVisibility = panel.children[3];
//    invisibleIgnoresVisibility.setVisible(false);
    invisibleIgnoresVisibility.styles["display"] = "none";
    invisibleIgnoresVisibility.styles["visibility"] = "hidden";
    var layout = new th.formlayout.FormLayout(
        "pref, pref, pref, pref",
        "pref, pref, pref, pref");
    layout.setHonorsVisibility(containerHonorsVisibility);

    layout.setHonorsVisibility(invisibleHonorsVisibility, true);
    layout.setHonorsVisibility(invisibleIgnoresVisibility, false);

    th.forEach(panel.children, function(component) {
        layout.addLayoutComponent(component, new th.formlayout.CellConstraints(component.layoutdata));
    });

    panel.layout = function() {
        layout.layoutContainer(this);
    }
    var info = layout.getLayoutInfo(panel);

    var size1 = 10;
    var size2 = containerHonorsVisibility ? 0 : 10;
    var size3 = 0;
    var size4 = 10;
    var origin1 = size1;
    var origin2 = origin1 + size2;
    var origin3 = origin2 + size3;
    var origin4 = origin3 + size4;
    assertEquals("Column 0",  0,       info.columnOrigins[0]);
    assertEquals("Column 1",  origin1, info.columnOrigins[1]);
    assertEquals("Column 2",  origin2, info.columnOrigins[2]);
    assertEquals("Column 3",  origin3, info.columnOrigins[3]);
    assertEquals("Column 4",  origin4, info.columnOrigins[4]);
    assertEquals("Row 0",     0,       info.rowOrigins[0]);
    assertEquals("Row 1",     origin1, info.rowOrigins[1]);
    assertEquals("Row 2",     origin2, info.rowOrigins[2]);
    assertEquals("Row 3",     origin3, info.rowOrigins[3]);
    assertEquals("Row 4",     origin4, info.rowOrigins[4]);
}

