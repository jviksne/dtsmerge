#!/usr/bin/env node

import * as fs from 'fs';
import * as path from 'path';

// Regular expression to identify included library files.
// Based on fullTripleSlashReferencePathRegEx and isRecognizedTripleSlashComment
// from TypeScript-3.8.3\src\compiler\utilities.ts.
const fullTripleSlashReferenceLibRegEx = /^(\/\/\/\s*<reference\s+lib\s*=\s*)('|")(.+?)\2.*?\/>/;

var newline = "\n";

var inFilePaths: string[] = [];     // [file...]
var stripComments: boolean = false; // -c, --stripcomm
var licenseFilePath: string = "";   // -l, --license [file]
var keepFirstBlockComment: boolean = false;   // -l, --license [file]
var outFilePath: string = "";       // -o, --out [file]
var infoComments: boolean = false;  // -i, --info

var includedFilePaths: {[path: string]: boolean} = {};
var outLines: string[] = [];
var isFirstFile: boolean = true;

function printHelp() {
    console.log(`
Syntax: dtsmerge [options] [file...]

Examples: dtsmerge lib.d.ts
          dtsmerge --out merged.d.ts lib.d.ts

Options:
 -h, --help                                     Print this message and exits.
 -o, --out [file]                               Write output to file. If ommitted outputs is written to console.
 -s, --stripcomm                                Remove comments
 -k, --keep                                     Keep first block comment (e.g. license header).
 -l, --license [file]                           A file containing the license header to be added to the output.
 -i, --info                                     Append "// START OF [file]" "// END OF [file]" comments before
                                                and after each included file
    `)
    process.exit(0);
}

function exitWithError(err: string, ...optionalParams: any[]) {
    console.error(err, ...optionalParams);
    process.exit(-1);
}

function getCommentFreeLine(line: string, inBlockComment: boolean, keepFirstBlockComment: boolean): [string, boolean, boolean, boolean] {

    var commFreeLine: string[] = [];
    var prevC: string = '';
    var commentExists = inBlockComment;
    var firstBlockCommentKept = false;
    var keepingFirstBlockComment = inBlockComment && keepFirstBlockComment;

    for (let i=0; i<line.length; i++) {
        let c = line[i];
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
            } else if (!keepingFirstBlockComment) {
                prevC = c;
                continue;
            }
        } else if (prevC == '/') {
            if (c == '/') {
                prevC = '';
                commentExists = true;
                break; // ignore the rest of the line
            } else if (c == '*') {
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

    line = commFreeLine.join("")

    return [line, inBlockComment, commentExists && line == "", firstBlockCommentKept];
}

function processFile(filePath: string) {

    // skip already included files
    if (includedFilePaths[filePath]) {
        return;
    }

    var thisIsFirstFile = isFirstFile;
    isFirstFile = false;

    var firstBlockCommentKept = false;

    includedFilePaths[filePath] = true;

    var fileDir = path.dirname(filePath);

    var data: string;
    try {
        data = fs.readFileSync(filePath, 'utf-8');
    } catch (e) {
        return exitWithError("Error reading library file!\n%s", e); // file path is present in error message
    }

    outLines.push("\n" + (infoComments?"// START OF "+path.basename(filePath):""))

    var lines = data.split(/\r?\n/);

    var inBlockComment = false;

    lines.forEach((line) => {

        // It is safe to check refInclude before removing comments because such lines start with //
        let refInclude = line.match(fullTripleSlashReferenceLibRegEx);
        if (refInclude && refInclude[3]) {
            let incFilePath = refInclude[3];
            if (!incFilePath.startsWith("lib.")) {
                incFilePath = "lib."+incFilePath;
            }
            if (!incFilePath.endsWith(".d.ts")) {
                incFilePath += ".d.ts";
            }
            processFile(path.isAbsolute(incFilePath) ? incFilePath : path.join(fileDir, incFilePath));
        } else if (stripComments) {

            let wholeLineInBlockComm: boolean;
            let firstBlockCommentKeptNow: boolean;
            [line, inBlockComment, wholeLineInBlockComm, firstBlockCommentKeptNow] = getCommentFreeLine(line, inBlockComment, thisIsFirstFile && keepFirstBlockComment && !firstBlockCommentKept);
            if (firstBlockCommentKeptNow) {
                firstBlockCommentKept = true;
            }

            if (!wholeLineInBlockComm) {
                outLines.push(line);
            }
    
        } else {
            outLines.push(line);
        }

    });

    if (infoComments) {
        outLines.push("// END OF "+path.basename(filePath))
    }

}

// if no arguments passed print help
if (process.argv.length == 2) {
    printHelp();
}

for (let i=2; i<process.argv.length; i++) {

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
    } catch(e) {
        exitWithError("Error reading license file!\n%s", e); // file path is present in error message
    }
}

for (let i=0; i<inFilePaths.length; i++) {
    processFile(inFilePaths[i]);
}

outContents += outLines.join(newline);

if (outFilePath != "") {
    try {
        fs.writeFileSync(outFilePath, outContents)
    } catch(e) {
        exitWithError("error writing to file %q: %s", outFilePath, e);
    }
} else {
    console.log(outContents)
}



