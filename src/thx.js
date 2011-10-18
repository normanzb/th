th.FirefoxBorder = Class.define({
    type: "Border",

    uses: [
        th.ComponentHelpers,
        th.BorderHelpers,
        th.ColorHelpers
    ],

    members: {
        SIDES: ["top", "right", "bottom", "left"],
        CORNERS: ["top-left", "top-right", "bottom-right", "bottom-left"],

        TOP: 0,     TOP_LEFT: 0,
        RIGHT: 1,   TOP_RIGHT: 1,
        BOTTOM: 2,  BOTTOM_RIGHT:2,
        LEFT: 3,    BOTTOM_LEFT: 3,

        BIT_TOP: 1,
        BIT_RIGHT: 2,
        BIT_BOTTOM: 4,
        BIT_LEFT: 8,

        init: function (component) {
            this.component = component;

            this.outerRect = {x: 0, y: 0, w: 0, h: 0};
            this.innerRect = {x: 0, y: 0, w: 0, h: 0};

            this.borderStyles = [];
            this.borderWidths = [];
            this.borderRadii = [];
            this.borderColors = [];
            this.borderColorsDark = [];
            this.borderColorsLight = [];
            this.skipSides = 0;
            this.oneUnitBorder = false;
            this.noBorderRadius = false;
            this.cornerDimensions = [];

            // populate the lists
            for (var i = 0; i < 4; i++) {
                this.borderStyles[i] = "none";
                this.borderWidths[i] = 0;
                this.borderColors[i] = "black";
                this.borderColorsDark[i] = "black";
                this.borderColorsLight[i] = "black";
                this.borderRadii[i] = {w: 0, h: 0};
                this.cornerDimensions[i] = {w: 0, h: 0};
            }

            this.borderDataCalculated = false;
        },

        getInsets: function() {
            return this.calculateInsets("border-", "-width");
        },

        recalculateBorderData: function () {
            var d = this.component.d();
            var x1, x2, x3; // TODO: find more descriptive names

            this.backgroundColor = this.getColorString(this.getColorRGB(this.component.cssValue("background-color")));

            for (var i = 0; i < 4; i++) {
                var side = this.SIDES[i];
                x1 = th.convertBorderLengthToPixels(this.component.cssValue("border-" + side + "-width"));
                x2 = this.getColorString(this.getColorRGB(this.component.cssValue("border-" + side + "-color")));
                x3 = this.component.cssValue("border-" + side + "-style");
                this.borderWidths[i] = (x1 === undefined) ? 0 : x1;
                this.borderColors[i] = x2;
                this.borderColorsDark[i] = this.getColorString(this.getSpecial3DColors(x2, this.backgroundColor, "dark"));
                this.borderColorsLight[i] = this.getColorString(this.getSpecial3DColors(x2, this.backgroundColor, "light"));
                this.borderStyles[i] = (x3 === undefined) ? "none" : x3;
            }

            this.outerRect = {x: 0, y: 0, w: d.b.w, h: d.b.h};
            this.innerRect = {x: 0, y: 0, w: d.b.w, h: d.b.h};
            this.inset(this.innerRect, this.borderWidths);

            // TODO: find a nicer way to calculate the corner dimensions
            this.cornerDimensions[0].w = this.borderWidths[3];
            this.cornerDimensions[0].h = this.borderWidths[0];
            this.cornerDimensions[1].w = this.borderWidths[1];
            this.cornerDimensions[1].h = this.borderWidths[0];
            this.cornerDimensions[2].w = this.borderWidths[1];
            this.cornerDimensions[2].h = this.borderWidths[2];
            this.cornerDimensions[3].w = this.borderWidths[3];
            this.cornerDimensions[3].h = this.borderWidths[2];

            this.oneUnitBorder = this.checkFourFloatsEqual(this.borderWidths, 1);
            this.noBorderRadius = this.allCornersZeroSize(this.borderRadii);

            this.borderDataCalculated = true;
        },

        areBorderSideFinalStylesSame: function (aSides) {
            if (aSides == 0) throw "th.Border:areBorderSideFinalStyleSame - Invalid side bit-field '0'";
            // check if the styles and colors are the same for all sides
            firstStyle = 0;
            for (var i = 0; i < 4; i++) {
                if (firstStyle == i) {
                    if (((1 << i) & aSides) == 0)
                        firstStyle++;
                    continue;
                }
                if (((1 << i) & aSides) == 0)
                    continue;
                if (this.borderStyles[firstStyle] != this.borderStyles[i] ||
                    this.borderColors[firstStyle] != this.borderColors[i])
                    return false;
            }

            switch(this.borderStyles[firstStyle]) {
                case "groove":
                case "ridge":
                case "inset":
                case "outset":
                    return ((aSides & (this.BIT_TOP | this.BIT_LEFT)) == 0 ||
                            (aSides & (this.BIT_BOTTOM | this.BIT_RIGHT)) == 0)
            }

            return true;
        },

        isSolidCornerStyle: function (style, aCorner) {
            switch(style) {
                case "dotted":
                case "dashed":
                case "solid":
                    return true;
                case "inset":
                case "outset":
                    return aCorner == this.TOP_LEFT || aCorner == this.BOTTOM_RIGHT;
                case "groove":
                case "ridge":
                    return this.oneUnitBorder && (aCorner == this.TOP_LEFT || aCorner == this.BOTTOM_RIGHT);
                case "double":
                    return this.oneUnitBorder;
                default:
                    return false;
            }
        },

        borderColorStyleForSolidCorner: function (style, aCorner) {
            switch (style) {
                case "dotted":
                case "dashed":
                case "solid":
                case "double":
                    return "solid";
                case "inset":
                case "groove":
                    if (aCorner == this.TOP_LEFT)
                        return "dark";
                    else if (aCorner == this.BOTTOM_RIGHT)
                        return "light";
                    break;
                case "outset":
                case "ridge":
                    if (aCorner == this.TOP_LEFT)
                        return "light";
                    else if (aCorner == this.BOTTOM_RIGHT)
                        return "dark";
                    break;
            }
            return "none";
        },

        doCornerSubPath: function (ctx, aCorner) {
            var offset = {x:0, y:0};
            if (aCorner == this.TOP_RIGHT || aCorner == this.BOTTOM_RIGHT)
                offset.x = this.outerRect.w - this.cornerDimensions[aCorner].w;
            if (aCorner == this.BOTTOM_RIGHT || aCorner == this.BOTTOM_LEFT)
                offset.y = this.outerRect.h - this.cornerDimensions[aCorner].h;
            ctx.rect(this.outerRect.x + offset.x, this.outerRect.y + offset.y,
                    this.cornerDimensions[aCorner].w, this.cornerDimensions[aCorner].h);
        },

        doSideClipWithoutCornersSubPath: function (ctx, aSide) {
            var offset = {x: 0, y: 0};
            var nextSide = this.next(aSide);
            if (aSide == this.TOP) {
                offset.x = this.cornerDimensions[this.TOP_LEFT].w;
            } else if (aSide == this.RIGHT) {
                offset.x = this.outerRect.w - this.borderWidths[this.RIGHT];
                offset.y = this.cornerDimensions[this.TOP_RIGHT].h;
            } else if (aSide == this.BOTTOM) {
                offset.x = this.cornerDimensions[this.BOTTOM_LEFT].w;
                offset.y = this.outerRect.h - this.borderWidths[this.BOTTOM];
            } else if (aSide == this.LEFT) {
                offset.y = this.cornerDimensions[this.TOP_LEFT].h;
            }

            var sideCornerSum = {w: 0, h: 0};
            sideCornerSum.w = this.cornerDimensions[aSide].w + this.cornerDimensions[nextSide].w;
            sideCornerSum.h = this.cornerDimensions[aSide].h + this.cornerDimensions[nextSide].h;

            var rect = {x: this.outerRect.x + offset.x, y: this.outerRect.y + offset.y,
                        w: this.outerRect.w - sideCornerSum.w, h: this.outerRect.h - sideCornerSum.h};

            if (aSide == this.TOP || aSide == this.BOTTOM)
                rect.h = this.borderWidths[aSide];
            else
                rect.w = this.borderWidths[aSide];

            ctx.rect(rect.x, rect.y, rect.w, rect.h);
        },

        maybeMoveToMidPoint: function (aP0, aP1, aMidPoint) {
            var ps = {x: aP1.x - aP0.x, y: aP1.y - aP0.y};

            if (ps.x != 0 && ps.y != 0) {
                k = Math.min((aMidPoint.x - aP0.x) / ps.x,
                        (aMidPoint.y - aP1.y) / ps.y);
                aP1.x = aP0.x + ps.x * k;
                aP1.y = aP0.y + ps.y * k;
            }
        },

        doSideClipSubPath: function (ctx, aSide) {
            var corner = this.corner; // function caching
            var start = [{x: 0, y: 0}, {x: 0, y: 0}];
            var end = [{x: 0, y: 0}, {x: 0, y: 0}];
            var prevSide = this.prev(aSide);
            var nextSide = this.next(aSide);

            var isDashed = this.borderStyles[aSide] == "dashed" || this.borderStyles[aSide] == "dotted";
            var startIsDashed = this.borderStyles[prevSide] == "dashed" || this.borderStyles[prevSide] == "dotted";;
            var endIsDashed = this.borderStyles[nextSide] == "dashed" || this.borderStyles[nextSide] == "dotted";;

            var startType = 0; // Trapezoid
            var endType = 0; // Trapezoid

            if (!this.isZeroSize(this.borderRadii[aSide]))
                startType = 1; // Trapezoid Full
            else if (startIsDashed && isDashed)
                startType = 2; // Rectangle

            if (!this.isZeroSize(this.borderRadii[nextSide]))
                endType = 1; // Trapezoid Full
            else if (startIsDashed && isDashed)
                endType = 2; // Rectangle

            var midPoint = {x:0, y:0};
            midPoint.x = this.innerRect.x + this.innerRect.w / 2.0;
            midPoint.y = this.innerRect.y + this.innerRect.h / 2.0;

            var cornerX = this.cornerX, cornerY = this.cornerY;
            start[0].x = cornerX(this.outerRect, aSide);
            start[0].y = cornerY(this.outerRect, aSide);
            start[1].x = cornerX(this.innerRect, aSide);
            start[1].y = cornerY(this.innerRect, aSide);

            end[0].x = cornerX(this.outerRect, nextSide);
            end[0].y = cornerY(this.outerRect, nextSide);
            end[1].x = cornerX(this.innerRect, nextSide);
            end[1].y = cornerY(this.innerRect, nextSide);

            if (startType == 1) { // Trapezoid Full
                this.maybeMoveToMidPoint(start[0], start[1], midPoint);
            } else if (startType == 2) { // Rectangle
                if (side == "top" || side == "bottom") {
                    start[1].x = cornerX(this.outerRect, aSide);
                    start[1].y = cornerY(this.innerRect, aSide);
                } else {
                    start[1].x = cornerX(this.innerRect, aSide);
                    start[1].y = cornerY(this.outerRect, aSide);
                }
            }

            if (endType == 1) { // Trapezoid Full
                this.maybeMoveToMidPoint(end[0], end[1], midPoint);
            } else if (endType == 2) { // Rectangle
                if (side == "top" || side == "bottom") {
                    end[0].x = cornerX(this.innerRect, nextSide);
                    end[0].y = cornerY(this.outerRect, nextSide);
                } else {
                    end[0].x = cornerX(this.outerRect, nextSide);
                    end[0].y = cornerY(this.innerRect, nextSide);
                }
            }

            ctx.moveTo(start[0].x, start[0].y);
            ctx.lineTo(end[0].x, end[0].y);
            ctx.lineTo(end[1].x, end[1].y);
            ctx.lineTo(start[1].x, start[1].y);
            ctx.closePath();
        },

        fillSolidBorder: function (ctx, outerRect, innerRect, borderRadii, borderSizes, aSides, color) {
            ctx.fillStyle = color;
            if (borderRadii !== undefined && !this.allCornersZeroSize(borderRadii)) {
                // if we have rounded corners, just draw an entire filled rectangle, clipping will deal with what remains visible later
                var innerRadii = this.computeInnerRadii(borderRadii, borderSizes);
                ctx.beginPath();
                this.traceRoundRect(ctx, outerRect, borderRadii, true);
                this.traceRoundRect(ctx, innerRect, innerRadii, false);
                ctx.fill();
                return;
            }

            // 15 = 1 + 2 + 4 + 8 = top + right + bottom + left
            if (aSides == 15 && this.checkFourFloatsEqual(borderSizes, borderSizes[0])) {
                var or = outerRect;
                var r = {x: or.x, y: or.y, w: or.w, h: or.h};
                this.inset(r, borderSizes[0] / 2.0);
                ctx.strokeStyle = color;
                ctx.lineWidth = borderSizes[0];
                ctx.beginPath();
                ctx.rect(r.x, r.y, r.w, r.h);
                ctx.stroke();
                return;
            }

            // one rectangle per side
            var rtx, rty, rtw, rth;
            var rrx, rry, rrw, rrh;
            var rbx, rby, rbw, rbh;
            var rlx, rly, rlw, rlh;

            if (aSides & 1) { // top
                rtx = outerRect.x;
                rty = outerRect.y;
                rtw = outerRect.w;
                rth = borderSizes[0];
            }
            if (aSides & 4) { // bottom
                rbx = outerRect.x;
                rby = outerRect.y + outerRect.h - borderSizes[2];
                rbw = outerRect.w;
                rbh = borderSizes[2];
            }
            if (aSides & 8) { // left
                rlx = outerRect.x;
                rly = outerRect.y;
                rlw = borderSizes[3];
                rlh = outerRect.h;
            }
            if (aSides & 2) { // right
                rrx = outerRect.x + outerRect.w - borderSizes[1];
                rry = outerRect.y;
                rrw = borderSizes[1];
                rrh = outerRect.h;
            }

            // trim out the corners, if there are any
            if ((aSides & 9) == 9) {
                // TOP + LEFT
                rly += borderSizes[0];
                rlh -= borderSizes[0];
            }
            if ((aSides & 3) == 3) {
                // TOP + RIGHT
                rtw -= borderSizes[1];
            }
            if ((aSides & 6) == 6) {
                // BOTTOM + RIGHT
                rrh -= borderSizes[2];
            }
            if ((aSides & 12) == 12) {
                // BOTTOM + LEFT
                rbx += borderSizes[3];
                rbw -= borderSizes[3];
            }

            if (aSides & 1) {
                ctx.fillRect(rtx, rty, rtw, rth);
            }
            if (aSides & 2) {
                ctx.fillRect(rrx, rry, rrw, rrh);
            }
            if (aSides & 4) {
                ctx.fillRect(rbx, rby, rbw, rbh);
            }
            if (aSides & 8) {
                ctx.fillRect(rlx, rly, rlw, rlh);
            }
        },

        makeBorderColor: function (side, aBorderColorStyle) {
            var colors;
            var k = 0;
            switch (aBorderColorStyle) {
                case "none":
                    return "black";
                case "light":
                    return this.borderColorsLight[side];
                case "dark":
                    return this.borderColorsDark[side];
                case "solid":
                default:
                    return this.borderColors[side];
            }
        },

        computeColorForLine: function (aLineIndex, aBorderColorStyle, aBorderColorStyleCount, aBorderColor, aBackgroundColor) {
            return this.makeBorderColor(aLineIndex, aBorderColorStyle[aLineIndex]);
        },

        drawBorderSides: function (ctx, aSides) {
            if (aSides == 0)
                return;
            var borderRenderStyle;
            var borderRenderColor;
            var borderColorStyleTopLeft = [];
            var borderColorStyleBottomRight = [];
            var borderColorStyleCount = 0;
            var borderColorStyle = [];

            for (var i = 0; i < 4; i++) {
                if (((1 << i) & aSides) == 0)
                    continue;
                borderRenderStyle = this.borderStyles[i];
                borderRenderColor = this.borderColors[i];
                break;
            }

            if (borderRenderStyle == "none" ||
                borderRenderStyle == "hidden")
                return;

            // composite colors are not suppoeted, if they were, here is the place to handle painting using them

            if (this.oneUnitBorder && (borderRenderStyle == "ridge" ||
                        borderRenderStyle == "groove" ||
                        borderRenderStyle == "double"))
                // if the border is 1px wide, all the above styles are like solid
                borderRenderStyle = "solid";
            switch (borderRenderStyle) {
                case "solid":
                case "dashed":
                case "dotted":
                    borderColorStyleTopLeft[0] = "solid";
                    borderColorStyleBottomRight[0] = "solid";
                    borderColorStyleCount = 1;
                    break;
                case "groove":
                    borderColorStyleTopLeft[0] = "dark";
                    borderColorStyleTopLeft[1] = "light";
                    borderColorStyleBottomRight[0] = "light";
                    borderColorStyleBottomRight[1] = "dark";
                    borderColorStyleCount = 2;
                    break;
                case "ridge":
                    borderColorStyleTopLeft[0] = "light";
                    borderColorStyleTopLeft[1] = "dark";
                    borderColorStyleBottomRight[0] = "dark";
                    borderColorStyleBottomRight[1] = "light";
                    borderColorStyleCount = 2;
                    break;
                case "double":
                    borderColorStyleTopLeft[0] = "solid";
                    borderColorStyleTopLeft[1] = "none";
                    borderColorStyleTopLeft[2] = "solid";
                    borderColorStyleBottomRight[0] = "solid";
                    borderColorStyleBottomRight[1] = "none";
                    borderColorStyleBottomRight[2] = "solid";
                    borderColorStyleCount = 3;
                    break;
                case "inset":
                    borderColorStyleTopLeft[0] = "dark";
                    borderColorStyleBottomRight[0] = "light";
                    borderColorStyleCount = 1;
                    break;
                case "outset":
                    borderColorStyleTopLeft[0] = "light";
                    borderColorStyleBottomRight[0] = "dark";
                    borderColorStyleCount = 1;
                    break;
                default:
                    throw "Unhandled style '" + borderRenderStyle +"'";
                    break;
            }

            if (aSides & (this.BIT_RIGHT | this.BIT_BOTTOM))
                borderColorStyle = borderColorStyleBottomRight;
            else
                borderColorStyle = borderColorStyleTopLeft;

            var borderWidths= [[], [], []];
            if (borderColorStyleCount == 1) {
                for (var i = 0; i < 4; i++) {
                    borderWidths[0][i] = this.borderWidths[i];
                }
            } else if (borderColorStyleCount == 2) {
                for (var i = 0; i < 4; i++) {
                    var w = this.borderWidths[i];
                    borderWidths[0][i] = parseInt(w / 2) + w % 2;
                    borderWidths[1][i] = parseInt(w / 2);
                }
            } else if (borderColorStyleCount == 3) {
                for (var i = 0; i < 4; i++) {
                    var w = this.borderWidths[i];
                    if (w == 1) {
                        borderWidths[0][i] = 1.0;
                        borderWidths[1][i] = borderWidths[2][i] = 0.0;
                    } else {
                        var rest = w % 3;
                        borderWidths[0][i] = borderWidths[2][i] = borderWidths[1][i] = parseInt((w - rest) / 3);
                        if (rest == 1) {
                            borderWidths[1][i]++;
                        } else if (rest == 2) {
                            borderWidths[0][i]++;
                            borderWidths[2][i]++;
                        }
                    }
                }
            }

            var or = this.outerRect;
            var oRect = {x: or.x, y: or.y, w: or.w, h: or.h};
            var iRect = {x: or.x, y: or.y, w: or.w, h: or.h};
            var radii;
            if (!this.noBorderRadius) radii = th.clone(this.borderRadii);
            var bw;
            for (var i = 0; i < borderColorStyleCount; i++) {
                bw = borderWidths[i];
                this.inset(iRect, bw);

                if (borderColorStyle[i] != "none") {
                    var color = this.computeColorForLine(i, borderColorStyle, borderColorStyleCount, borderRenderColor, this.backgroundColor);
                    this.fillSolidBorder(ctx, oRect, iRect, radii, bw, aSides, color);
                }

                if (!this.noBorderRadius) radii = this.computeInnerRadii(radii, bw);

                // the outer rect of the next round is the innder rect of this one
                oRect.x = iRect.x;
                oRect.y = iRect.y;
                oRect.w = iRect.w;
                oRect.h = iRect.h;
            }
        },

        paint: function (ctx) {
            if (this.component.cssValue("border-image-url") === undefined) {
                this.paintBorder(ctx)
            } else {
                this.paintImageBorder(ctx);
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

        paintBorder: function (ctx) {
            var b = this.component.d();

            var isZero = this.isZeroSize; // caching the function for optimization

            // always recalculate the borderData, as this might change by addCss and noticing this is not implemented yet!
            //if (!this.borderDataCalculated) this.recalculateBorderData();
            this.recalculateBorderData();

            var tlBordersSame = this.areBorderSideFinalStylesSame(1|8); // top+left
            var brBordersSame = this.areBorderSideFinalStylesSame(2|4); // bottom+right
            var allBordersSame = this.areBorderSideFinalStylesSame(15); // all sides

            if (allBordersSame && (this.borderStyles[0] == "none" ||
                        this.borderStyles[0] == "hidden"))
                return;

            this.round(this.outerRect);
            this.round(this.innerRect);

            if (this.emptyRect(this.outerRect))
                return;

            if (allBordersSame) {
                this.drawBorderSides(ctx, this.BIT_TOP | this.BIT_RIGHT | this.BIT_BOTTOM | this.BIT_LEFT);
            } else {
                for (var corner = 0; corner < 4; corner++) {
                    var sides = [corner, this.prev(corner)];
                    if (!isZero(this.borderRadii[corner]))
                        continue;

                    if (this.borderWidths[sides[0]] == 1 && this.borderWidths[sides[1]] == 1) {
                        if (corner == this.TOP_LEFT || corner == this.TOP_RIGHT)
                            this.cornerDimensions[corner].w = 0;
                        else
                            this.cornerDimensions[corner].h = 0;
                    }
                }

                for (var corner = 0; corner < 4; corner++) {
                    if (isZero(this.cornerDimensions[corner]))
                        continue;

                    var sides = [corner, this.prev(corner)];
                    var sideBits = (1 << sides[0]) | (1 << sides[1]);

                    var simpleCornerStyle = this.areBorderSideFinalStylesSame(sideBits);
                    if (simpleCornerStyle && isZero(this.borderRadii[corner]) && this.isSolidCornerStyle(this.borderStyles[sides[0]], corner)) {
                        ctx.beginPath();
                        this.doCornerSubPath(ctx, corner);
                        ctx.fillStyle = this.makeBorderColor(
                            sides[0],
                            this.borderColorStyleForSolidCorner(this.borderStyles[sides[0]], corner)
                        );
                        ctx.fill();
                        continue;
                    }

                    ctx.save();
                    ctx.beginPath();
                    this.doCornerSubPath(ctx, corner);
                    ctx.clip();

                    if (simpleCornerStyle) {
                        this.drawBorderSides(ctx, sideBits);
                    } else {
                        var tmpctx = this.component.getScratchContext();
                        tmpctx.canvas.height = b.b.h;
                        tmpctx.canvas.width = b.b.w;
                        tmpctx.clearRect(0, 0, b.b.w, b.b.h);
                        tmpctx.globalCompositeOperation = "lighter"; // closest thing i have to "add"
                        for (var cornerSide = 0; cornerSide < 2; cornerSide++) {
                            var side = sides[cornerSide];
                            var style = this.borderStyles[side];
                            tmpctx.save();
                            tmpctx.beginPath();
                            this.doSideClipSubPath(tmpctx, side);
                            tmpctx.clip();
                            this.drawBorderSides(tmpctx, 1 << side);
                            tmpctx.restore();
                        }
                        ctx.globalCompositeOpertation = "source-over";
                        ctx.drawImage(tmpctx.canvas, 0, 0, b.b.w, b.b.h, 0, 0, b.b.w, b.b.h);
                    }
                    ctx.restore();
                }
                var alreadyDrawnSides = 0;
                if (this.oneUnitBorder && this.noBorderRadius) {
                    if (tlBordersSame) {
                        this.drawBorderSides(ctx, 1 | 8); // top + left
                        alreadyDrawnSides |= 1 | 8;
                    }
                    if (brBordersSame) {
                        this.drawBorderSides(ctx, 4 | 2);
                        alreadyDrawnSides |= 4 | 2;
                    }
                }
                for (var side = 0; side < 4; side++) {
                    if (alreadyDrawnSides & (1 << side))
                        continue;

                    if (this.borderWidths[side] == 0 ||
                        this.borderStyles[side] == "hidden" ||
                        this.borderStyles[side] == "none")
                        continue;

                    ctx.save();
                    ctx.beginPath();
                    this.doSideClipWithoutCornersSubPath(ctx, side);
                    ctx.clip();
                    this.drawBorderSides(ctx, 1 << side);
                    ctx.restore();
                }
            }
        }
    }
});