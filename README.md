# dtsmerge
 Merges all includes of a TypeScript lib.d.ts file into a single file.

## Installation

Download the files and run the following command within the base directory:

`npm install -g`

## Usage

From command line:

```
Syntax: dtsmerge [options] [file...]

Examples: dtsmerge lib.d.ts
          dtsmerge --out merged.d.ts lib.d.ts

Options:
 -h, --help                                     Print this message and exits.
 -o, --out [file]                               Write output to file. If ommitted outputs is written to console.
 -c, --stripcomm                                Remove comments
 -l, --license [file]                           A file containing the license header to be added to the output.
 -i, --info                                     Append "// START OF [file]" "// END OF [file]" comments before
                                                and after each included file
```
