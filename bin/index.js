#!/usr/bin/env node
"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
var fs = __importStar(require("fs"));
var path = __importStar(require("path"));
// Regular expression to identify included library files.
// Based on fullTripleSlashReferencePathRegEx and isRecognizedTripleSlashComment
// from TypeScript-3.8.3\src\compiler\utilities.ts.
var fullTripleSlashReferenceLibRegEx = /^(\/\/\/\s*<reference\s+lib\s*=\s*)('|")(.+?)\2.*?\/>/;
var newline = "\n";
var inFilePaths = []; // [file...]
var stripComments = false; // -c, --stripcomm
var licenseFilePath = ""; // -l, --license [file]
var keepFirstBlockComment = false; // -l, --license [file]
var outFilePath = ""; // -o, --out [file]
var infoComments = false; // -i, --info
var includedFilePaths = {};
var outLines = [];
var isFirstFile = true;
function printHelp() {
    console.log("\nSyntax: dtsmerge [options] [file...]\n\nExamples: dtsmerge lib.d.ts\n          dtsmerge --out merged.d.ts lib.d.ts\n\nOptions:\n -h, --help                                     Print this message and exits.\n -o, --out [file]                               Write output to file. If ommitted outputs is written to console.\n -s, --stripcomm                                Remove comments\n -k, --keep                                     Keep first block comment (e.g. license header).\n -l, --license [file]                           A file containing the license header to be added to the output.\n -i, --info                                     Append \"// START OF [file]\" \"// END OF [file]\" comments before\n                                                and after each included file\n    ");
    process.exit(0);
}
function exitWithError(err) {
    var optionalParams = [];
    for (var _i = 1; _i < arguments.length; _i++) {
        optionalParams[_i - 1] = arguments[_i];
    }
    console.error.apply(console, [err].concat(optionalParams));
    process.exit(-1);
}
function getCommentFreeLine(line, inBlockComment, keepFirstBlockComment) {
    var commFreeLine = [];
    var prevC = '';
    var commentExists = inBlockComment;
    var firstBlockCommentKept = false;
    var keepingFirstBlockComment = inBlockComment && keepFirstBlockComment;
    for (var i = 0; i < line.length; i++) {
        var c = line[i];
        if (inBlockComment) {
            if (prevC == '*' && c == '/') {
                inBlockComment = false;
                if (keepingFirstBlockComment) {
                    firstBlockCommentKept = true;
                    commFreeLine.push('*/');
                }
                keepingFirstBlockComment = false;
                prevC = '';
                continue;
            }
            else if (!keepingFirstBlockComment) {
                prevC = c;
                continue;
            }
        }
        else if (prevC == '/') {
            if (c == '/') {
                prevC = '';
                commentExists = true;
                break; // ignore the rest of the line
            }
            else if (c == '*') {
                inBlockComment = true;
                prevC = '';
                commentExists = true;
                if (keepFirstBlockComment && !firstBlockCommentKept) {
                    keepingFirstBlockComment = true;
                    commFreeLine.push('/*');
                }
                continue;
            }
        }
        commFreeLine.push(prevC);
        prevC = c;
    }
    if (!inBlockComment && !keepingFirstBlockComment) {
        commFreeLine.push(prevC);
    }
    line = commFreeLine.join("");
    return [line, inBlockComment, commentExists && line == "", firstBlockCommentKept];
}
function processFile(filePath) {
    // skip already included files
    if (includedFilePaths[filePath]) {
        return;
    }
    var thisIsFirstFile = isFirstFile;
    isFirstFile = false;
    var firstBlockCommentKept = false;
    includedFilePaths[filePath] = true;
    var fileDir = path.dirname(filePath);
    var data;
    try {
        data = fs.readFileSync(filePath, 'utf-8');
    }
    catch (e) {
        return exitWithError("Error reading library file!\n%s", e); // file path is present in error message
    }
    outLines.push("\n" + (infoComments ? "// START OF " + path.basename(filePath) : ""));
    var lines = data.split(/\r?\n/);
    var inBlockComment = false;
    lines.forEach(function (line) {
        var _a;
        // It is safe to check refInclude before removing comments because such lines start with //
        var refInclude = line.match(fullTripleSlashReferenceLibRegEx);
        if (refInclude && refInclude[3]) {
            var incFilePath = refInclude[3];
            if (!incFilePath.startsWith("lib.")) {
                incFilePath = "lib." + incFilePath;
            }
            if (!incFilePath.endsWith(".d.ts")) {
                incFilePath += ".d.ts";
            }
            processFile(path.isAbsolute(incFilePath) ? incFilePath : path.join(fileDir, incFilePath));
        }
        else if (stripComments) {
            var wholeLineInBlockComm = void 0;
            var firstBlockCommentKeptNow = void 0;
            _a = getCommentFreeLine(line, inBlockComment, thisIsFirstFile && keepFirstBlockComment && !firstBlockCommentKept), line = _a[0], inBlockComment = _a[1], wholeLineInBlockComm = _a[2], firstBlockCommentKeptNow = _a[3];
            if (firstBlockCommentKeptNow) {
                firstBlockCommentKept = true;
            }
            if (!wholeLineInBlockComm) {
                outLines.push(line);
            }
        }
        else {
            outLines.push(line);
        }
    });
    if (infoComments) {
        outLines.push("// END OF " + path.basename(filePath));
    }
}
// if no arguments passed print help
if (process.argv.length == 2) {
    printHelp();
}
for (var i = 2; i < process.argv.length; i++) {
    switch (process.argv[i]) {
        case "-h":
        case "--help":
            printHelp();
            break;
        case "-o":
        case "--out":
            if (i >= process.argv.length - 1) {
                exitWithError("no output file specified");
            }
            outFilePath = process.argv[++i];
            break;
        case "-l":
        case "--license":
            if (i >= process.argv.length - 1) {
                exitWithError("no license file specified");
            }
            licenseFilePath = process.argv[++i];
            break;
        case "-s":
        case "--stripcomm":
            stripComments = true;
            break;
        case "-i":
        case "--info":
            infoComments = true;
            break;
        case "-k":
        case "--keep":
            keepFirstBlockComment = true;
            break;
        default:
            inFilePaths.push(process.argv[i]);
    }
}
if (inFilePaths.length == 0) {
    exitWithError("no input file specified");
}
var outContents = "";
if (licenseFilePath != "") {
    try {
        outContents = fs.readFileSync(licenseFilePath, 'utf-8');
    }
    catch (e) {
        exitWithError("Error reading license file!\n%s", e); // file path is present in error message
    }
}
for (var i = 0; i < inFilePaths.length; i++) {
    processFile(inFilePaths[i]);
}
outContents += outLines.join(newline);
if (outFilePath != "") {
    try {
        fs.writeFileSync(outFilePath, outContents);
    }
    catch (e) {
        exitWithError("error writing to file %q: %s", outFilePath, e);
    }
}
else {
    console.log(outContents);
}
