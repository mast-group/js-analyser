# js-analyser
##Instrumentation Framework for JavaScript.

###Usage
```
node instrumenter.js [libraryFolderToInstrument] [OutputFolder] [OPTIONAL - Log file path | DEFAULT - OutputFolder/libraryName/log.txt] [OPTIONAL - Method Hash file path | DEFAULT - OutputFolder/libraryName/methodHash.txt]
```
**Log fie:** raw instrumented values will be stored in this file. You will need [js-analyser-util](https://github.com/mast-group/js-analyser-util) to perfom analyse on the data.

**Method Hash file:** Raw file stores hash codes to indicate methods to reduce file size and method hash file has the hash->method name mapping

Example:
```
node instrumenter.js /Users/Guest/Source/js-analyser/node_modules/esprima /Users/Guest/Documents
```
