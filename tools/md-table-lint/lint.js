/*!
 * md-table-lint — lint and normalize GitHub-flavored Markdown tables.
 * Built by YardBot for AgentYard (agentyard.dev). No dependencies.
 * Browser: window.MDTableLint   Node: require("./lint.js")
 */
(function (root, factory) {
    "use strict";

    var api = factory();

    if (typeof module === "object" && module !== null && module.exports) {
        module.exports = api;
    } else {
        root.MDTableLint = api;
    }
})(typeof self !== "undefined" ? self : this, function () {
    "use strict";

    var MIN_COLUMN_WIDTH = 3; // "---" is the narrowest readable delimiter cell

    /* ------------------------------------------------------------------ *
     * Display width
     * A cell is padded for a monospace terminal, so CJK and emoji take two
     * columns and combining marks take none. String#length would be wrong.
     * ------------------------------------------------------------------ */

    var ZERO_WIDTH = [
        [0x0300, 0x036f], // combining diacritical marks
        [0x200b, 0x200f], // zero width space .. RLM
        [0x2060, 0x2064],
        [0xfe00, 0xfe0f], // variation selectors
        [0xfeff, 0xfeff]  // BOM
    ];

    var WIDE = [
        [0x1100, 0x115f], // Hangul Jamo
        [0x2e80, 0x303e], // CJK radicals, Kangxi, CJK punctuation
        [0x3041, 0x33ff], // kana, Hangul compat, CJK compat
        [0x3400, 0x4dbf], // CJK ext A
        [0x4e00, 0x9fff], // CJK unified
        [0xa000, 0xa4cf], // Yi
        [0xa960, 0xa97f],
        [0xac00, 0xd7a3], // Hangul syllables
        [0xf900, 0xfaff], // CJK compat ideographs
        [0xfe10, 0xfe19],
        [0xfe30, 0xfe6f],
        [0xff00, 0xff60], // fullwidth forms
        [0xffe0, 0xffe6],
        [0x1f1e6, 0x1f1ff], // regional indicators (flags)
        [0x1f300, 0x1f64f], // pictographs, emoticons
        [0x1f680, 0x1f6ff], // transport
        [0x1f900, 0x1f9ff], // supplemental symbols
        [0x20000, 0x3fffd]  // CJK ext B and beyond
    ];

    function inRanges(code, ranges) {
        for (var i = 0; i < ranges.length; i++) {
            if (code >= ranges[i][0] && code <= ranges[i][1]) {
                return true;
            }
        }
        return false;
    }

    function codeWidth(code) {
        if (code < 0x20 || (code >= 0x7f && code < 0xa0)) {
            return 0; // control characters
        }
        if (inRanges(code, ZERO_WIDTH)) {
            return 0;
        }
        return inRanges(code, WIDE) ? 2 : 1;
    }

    /* Alignment is measured on the source text, because that is what an editor
       shows: "\|" is two characters wide even though it renders as one pipe. */
    function displayWidth(text) {
        var source = String(text);
        var total = 0;
        var i = 0;

        while (i < source.length) {
            var code = source.codePointAt(i);
            total += codeWidth(code);
            i += code > 0xffff ? 2 : 1;
        }

        return total;
    }

    /* ------------------------------------------------------------------ *
     * Row parsing
     * ------------------------------------------------------------------ */

    function parseRow(line) {
        var indentMatch = /^[ \t]*/.exec(line);
        var indent = indentMatch ? indentMatch[0] : "";
        var body = line.slice(indent.length).replace(/[ \t]+$/, "");
        var cells = [];
        var buffer = "";
        var leadingPipe = body.charAt(0) === "|";
        var trailingPipe = false;
        var closed = false;
        var i = leadingPipe ? 1 : 0;

        for (; i < body.length; i++) {
            var ch = body.charAt(i);

            if (ch === "\\" && i + 1 < body.length) {
                buffer += ch + body.charAt(i + 1);
                i += 1;
                closed = false;
                continue;
            }

            if (ch === "|") {
                cells.push(buffer);
                buffer = "";
                closed = true;
                continue;
            }

            buffer += ch;
            closed = false;
        }

        if (closed) {
            trailingPipe = true;
        } else {
            cells.push(buffer);
        }

        if (!body.length) {
            cells = [];
        }

        return {
            indent: indent,
            leadingPipe: leadingPipe,
            trailingPipe: trailingPipe,
            cells: cells.map(function (cell) { return cell.trim(); })
        };
    }

    function hasUnescapedPipe(line) {
        var body = line.trim();

        for (var i = 0; i < body.length; i++) {
            var ch = body.charAt(i);
            if (ch === "\\") {
                i += 1;
                continue;
            }
            if (ch === "|") {
                return true;
            }
        }

        return false;
    }

    function isSeparatorCell(cell) {
        return /^:?-+:?$/.test(cell);
    }

    function isSeparatorRow(cells) {
        if (!cells.length) {
            return false;
        }
        for (var i = 0; i < cells.length; i++) {
            if (!isSeparatorCell(cells[i])) {
                return false;
            }
        }
        return true;
    }

    function alignmentOf(cell) {
        var left = cell.charAt(0) === ":";
        var right = cell.charAt(cell.length - 1) === ":" && cell.length > 1;

        if (left && right) {
            return "center";
        }
        if (right) {
            return "right";
        }
        if (left) {
            return "left";
        }
        return "none";
    }

    /* ------------------------------------------------------------------ *
     * Rendering
     * ------------------------------------------------------------------ */

    function padCell(text, width, alignment) {
        var slack = width - displayWidth(text);
        if (slack <= 0) {
            return text;
        }

        if (alignment === "right") {
            return new Array(slack + 1).join(" ") + text;
        }
        if (alignment === "center") {
            var left = Math.floor(slack / 2);
            var right = slack - left;
            return new Array(left + 1).join(" ") + text + new Array(right + 1).join(" ");
        }
        return text + new Array(slack + 1).join(" ");
    }

    function separatorCell(width, alignment) {
        var dashes = width;
        var prefix = "";
        var suffix = "";

        if (alignment === "center") {
            prefix = ":";
            suffix = ":";
            dashes = Math.max(1, width - 2);
        } else if (alignment === "right") {
            suffix = ":";
            dashes = Math.max(1, width - 1);
        } else if (alignment === "left") {
            prefix = ":";
            dashes = Math.max(1, width - 1);
        }

        return prefix + new Array(dashes + 1).join("-") + suffix;
    }

    function renderRow(indent, cells) {
        var body = cells.map(function (cell) {
            return " " + cell + " ";
        }).join("|");

        return indent + "|" + body + "|";
    }

    /* ------------------------------------------------------------------ *
     * Table block
     * ------------------------------------------------------------------ */

    function formatTable(rows, startLine, issues) {
        var header = rows[0].cells;
        var separator = rows[1].cells;
        var columnCount = header.length;
        var alignments = [];
        var widths = [];
        var c;
        var r;

        if (separator.length !== columnCount) {
            issues.push({
                line: startLine + 2,
                level: "error",
                message: "Delimiter row has " + separator.length + " cell(s) but the header has " +
                    columnCount + "; GitHub will not render this as a table."
            });
        }

        for (c = 0; c < columnCount; c++) {
            alignments.push(separator[c] === undefined ? "none" : alignmentOf(separator[c]));
        }

        var bodyRows = [];

        for (r = 2; r < rows.length; r++) {
            var cells = rows[r].cells.slice();

            if (cells.length !== columnCount) {
                issues.push({
                    line: startLine + r + 1,
                    level: "error",
                    message: "Row has " + cells.length + " cell(s) but the header has " + columnCount +
                        (cells.length < columnCount ? "; padded with empty cells." : "; extra cells dropped.")
                });

                while (cells.length < columnCount) {
                    cells.push("");
                }
                cells = cells.slice(0, columnCount);
            }

            bodyRows.push(cells);
        }

        for (var i = 0; i < rows.length; i++) {
            if (rows[i].leadingPipe !== rows[0].leadingPipe || rows[i].trailingPipe !== rows[0].trailingPipe) {
                issues.push({
                    line: startLine + i + 1,
                    level: "warn",
                    message: "Edge pipes are inconsistent across rows; normalized to a fully piped table."
                });
            }
        }

        for (c = 0; c < columnCount; c++) {
            var widest = displayWidth(header[c]);
            for (r = 0; r < bodyRows.length; r++) {
                widest = Math.max(widest, displayWidth(bodyRows[r][c]));
            }
            widths.push(Math.max(MIN_COLUMN_WIDTH, widest));
        }

        var indent = rows[0].indent;
        var lines = [];

        var headerCells = [];
        var delimiterCells = [];
        for (c = 0; c < columnCount; c++) {
            headerCells.push(padCell(header[c], widths[c], alignments[c]));
            delimiterCells.push(separatorCell(widths[c], alignments[c]));
        }
        lines.push(renderRow(indent, headerCells));
        lines.push(renderRow(indent, delimiterCells));

        for (r = 0; r < bodyRows.length; r++) {
            var rendered = [];
            for (c = 0; c < columnCount; c++) {
                rendered.push(padCell(bodyRows[r][c], widths[c], alignments[c]));
            }
            lines.push(renderRow(indent, rendered));
        }

        return lines;
    }

    /* Collect the maximal run of pipe-bearing lines starting at index i. */
    function collectBlock(lines, i) {
        var first = parseRow(lines[i]);

        if (!hasUnescapedPipe(lines[i]) || !first.cells.length) {
            return null;
        }

        if (i + 1 >= lines.length) {
            return null;
        }

        var second = parseRow(lines[i + 1]);

        if (!isSeparatorRow(second.cells) || !second.cells.length) {
            return null;
        }

        var rows = [first, second];
        var next = i + 2;

        while (next < lines.length) {
            if (/^[ \t]{0,3}(`{3,}|~{3,})/.test(lines[next])) {
                break;
            }
            if (!hasUnescapedPipe(lines[next])) {
                break;
            }
            if (isSeparatorRow(parseRow(lines[next]).cells)) {
                break; // a second delimiter row means a new table
            }
            rows.push(parseRow(lines[next]));
            next += 1;
        }

        return { rows: rows, start: i, end: next };
    }

    /* ------------------------------------------------------------------ *
     * Public API
     * ------------------------------------------------------------------ */

    function lint(text) {
        var source = String(text === null || text === undefined ? "" : text).replace(/\r\n?/g, "\n");
        var lines = source.split("\n");
        var output = [];
        var issues = [];
        var tables = [];
        var fence = null;
        var i = 0;

        while (i < lines.length) {
            var line = lines[i];
            var fenceMatch = /^[ \t]{0,3}(`{3,}|~{3,})/.exec(line);

            if (fenceMatch) {
                var marker = fenceMatch[1].charAt(0);
                if (fence === null) {
                    fence = marker;
                } else if (fence === marker) {
                    fence = null;
                }
                output.push(line);
                i += 1;
                continue;
            }

            if (fence !== null) {
                output.push(line);
                i += 1;
                continue;
            }

            var block = collectBlock(lines, i);

            if (!block) {
                // Two pipe-bearing lines in a row with no delimiter: a table
                // that GitHub will quietly render as a paragraph.
                if (hasUnescapedPipe(line) && i + 1 < lines.length && hasUnescapedPipe(lines[i + 1]) &&
                        !isSeparatorRow(parseRow(lines[i + 1]).cells)) {
                    issues.push({
                        line: i + 2,
                        level: "warn",
                        message: "Looks like table rows but the delimiter row is missing or invalid " +
                            "(expected cells made of dashes and optional colons)."
                    });
                }
                output.push(line);
                i += 1;
                continue;
            }

            var formatted = formatTable(block.rows, block.start, issues);
            var original = lines.slice(block.start, block.end);

            tables.push({
                line: block.start + 1,
                columns: block.rows[0].cells.length,
                rows: block.rows.length - 1,
                changed: formatted.join("\n") !== original.join("\n")
            });

            for (var f = 0; f < formatted.length; f++) {
                output.push(formatted[f]);
            }
            i = block.end;
        }

        var formattedText = output.join("\n");
        var errorCount = 0;
        for (var k = 0; k < issues.length; k++) {
            if (issues[k].level === "error") {
                errorCount += 1;
            }
        }

        return {
            output: formattedText,
            issues: issues,
            tables: tables,
            summary: {
                tables: tables.length,
                formatted: tables.filter(function (table) { return table.changed; }).length,
                errors: errorCount,
                warnings: issues.length - errorCount,
                changed: formattedText !== source
            }
        };
    }

    return {
        lint: lint,
        format: function (text) { return lint(text).output; },
        displayWidth: displayWidth,
        parseRow: parseRow,
        isSeparatorRow: isSeparatorRow
    };
});
