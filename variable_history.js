/**
 * Created by Pankajan on 08/12/2015.
 */
var fs = require('fs-extra');
var esprima = require('esprima');
var estraverse = require('estraverse');
var escodegen = require('escodegen');
var util = require('./lib/util');
var path = require('path');
var crypto = require('crypto');
var shortid = require('shortid');

var LOG_FILE = ROOT + "Result/raw/" + 'log_' + PROJECT + '.txt';
var METHOD_HASH_FILE = ROOT + "Result/raw/method_hash/" + PROJECT + '.txt';

console.log('PROJECT : ' + PROJECT);

fs.unlinkSync(METHOD_HASH_FILE);

if (!module.parent) {
    // this is the main module
    var args = process.argv.slice(2);
    if(args.length<2) {
        console.log('Usage: <projectPath> <instrumentedProjectOutputPath> ' +
            '[OPTIONAL - LogFilePath (Default:instrumentedProjectOutputPath/log.txt) ]' +
            '[OPTIONAL - MethodHashFilePath (Default:instrumentedProjectOutputPath/methodHash.txt) ]');
    } else {
        process(args[0], args[1]);
    }
}





function process(filename, outFilename) {
    var stat = fs.lstatSync(filename);
    if(stat.isDirectory()) {
        //filename.indexOf('node_modules')==-1 &&
        if(filename.indexOf('/test')==-1 && filename.indexOf('__tests__')==-1) {
            fs.mkdirSync(outFilename);
            fs.readdir(filename, function (err, files) {
                if (err) {
                    fs.copy(filename, outFilename, {});
                    return console.error(err);
                }
                files.forEach(function (file) {
                    process(filename + "/" + file, outFilename + "/" + file);
                });
            });
        } else {
            fs.copy(filename, outFilename, {});
        }
    } else {
        if(stat.isFile() && path.extname(filename)==='.js') {
            try {
                var newCode = instrument(filename);
                fs.writeFile(outFilename, newCode, function (err) {
                    if (err)fs.copy(filename, outFilename, {});
                });
            } catch (err) {
                console.log(err);
                fs.copy(filename, outFilename, {});
            }
        } else {
            fs.copy(filename, outFilename, {});
        }
    }
}

var currentFileName;

function instrument(filename) {
    if(filename.endsWith('array.js')) {
        console.log();
    }
    currentFileName = filename;
    var srcCode = fs.readFileSync(filename, 'utf-8');
    if (srcCode.charAt(0) === '#') { //shebang, 'comment' it out, won't affect syntax tree locations for things we care about
        srcCode = '//' + srcCode;
    }
    var ast;
    try{
        ast = esprima.parse(srcCode, {
            range: true,
            tokens: true,
            comment: true
        });
    } catch (notAScript) {
        ast = esprima.parse(srcCode, {
            range: true,
            tokens: true,
            comment: true,
            sourceType: 'module'
        });
    }
    methodName = [];
    estraverse.traverse(ast, {
        enter: enter,
        leave: leave
    });
    methodName = [];
    var result = estraverse.replace(ast, {
        enter:methodSave,
        leave: replace
    });

    return escodegen.generate(result);
}

var scopeChain = [];
var modifiedVariables=[];
var calledMethods=[];

var methodName = [];
var methodNameDict = [];
function enter(node, parent) {
    if (createsNewScope(node)){
        if(node.type===util.astNodes.PROGRAM) {
            var declare_fs = "var instrument_fs = require('fs');";
            node.body.unshift(esprima.parse(declare_fs).body[0]);
        }
        var currentMethodName = getCurrentMethodName(node, parent);

        var fileHash = shortid.generate();
        methodName.push(fileHash);

        fs.appendFileSync(METHOD_HASH_FILE, currentMethodName + "->" + fileHash + "\n");
        methodNameDict[currentMethodName] = fileHash;

        var xx = "try { instrument_fs.appendFileSync('"+LOG_FILE+"', '>>" + fileHash + "');} catch (err){}";
        if(node.body!=undefined && node.body.body != undefined && node.body.body instanceof Array)
        node.body.body.unshift(esprima.parse(xx).body[0]);
        scopeChain.push([]);
        var params = node.params;

        if(params!=undefined) {
            for (i = 0; i < params.length; i++) {
                scopeChain[scopeChain.length - 1].push(params[i].name);
            }
        }
    } else if (node.type === util.astNodes.VARIABLE_DECLARATOR){
        scopeChain[scopeChain.length - 1].push(node.id.name);
    } else if (node.type === util.astNodes.IDENTIFIER){
        modifiedVariables.pushUnique(node.name);
    } else if (node.type === util.astNodes.ASSIGNMENT_EXPRESSION){
        modifiedVariables.pushUnique(escodegen.generate(node.left));
    } else if (node.type === util.astNodes.UPDATE_EXPRESSION) {
        modifiedVariables.pushUnique(node.argument.name);
    } else if (node.type === util.astNodes.CALL_EXPRESSION) {
        if(node.callee.name!= undefined)
            calledMethods.push(node.callee.name);
        else {
            //calledMethods.push(node.callee.property.name);
        }

    } else if (node.type === util.astNodes.EXPRESSION_STATEMENT) {
        modifiedVariables=[];
        calledMethods=[];
    }
}

function leave(node, parent){
    if (createsNewScope(node)){
        scopeChain.pop();
        var params = node.params;
        methodName.pop();
    } else if (node.type === util.astNodes.EXPRESSION_STATEMENT) {
        if(parent.body!=undefined && parent.body!=null) {
            var index=0;
            for(x=0; x<parent.body.length; x++) {
                if(parent.body[x].range===node.range) {
                    index=x;
                    break;
                }
            }

            var xx="";
            for (x = 0; x < modifiedVariables.length; x++) {
                if(modifiedVariables[x]!== undefined && modifiedVariables[x]!=='instrument_fs' && modifiedVariables[x]!=='require') {
                try {
                    if(modifiedVariables[x]==="math['false']") {
                        console.log();
                    }
//Original instrumentation of only the variable value
//                    xx = "try { if(typeof " + modifiedVariables[x] + " == 'number') {instrument_fs.appendFileSync('" + LOG_FILE + "', \"..." + methodName[methodName.length - 1] + "-_{" + modifiedVariables[x] + "}->{\"+" + modifiedVariables[x] + "+\"}\"); } } catch (err){}";

                    xx = "try { " +
                        "if(typeof " + modifiedVariables[x] + " == 'number') {" +
                        "instrument_fs.appendFileSync('" + LOG_FILE + "', \"..." + methodName[methodName.length - 1] + "-_{" + modifiedVariables[x] + "}->number{\"+" + modifiedVariables[x] + "+\"}\"); " +
                        "} else if(typeof " + modifiedVariables[x] + " == 'string') {" +
                        "instrument_fs.appendFileSync('" + LOG_FILE + "', \"..." + methodName[methodName.length - 1] + "-_{" + modifiedVariables[x] + "}->string{\"+" + modifiedVariables[x] + "+\"}\"); " +
                        "} else if(typeof " + modifiedVariables[x] + " == 'boolean') {" +
                        "instrument_fs.appendFileSync('" + LOG_FILE + "', \"..." + methodName[methodName.length - 1] + "-_{" + modifiedVariables[x] + "}->boolean{\"+" + modifiedVariables[x] + "+\"}\"); " +
                        "} else if(typeof " + modifiedVariables[x] + " == 'object') {" +
                        "instrument_fs.appendFileSync('" + LOG_FILE + "', \"..." + methodName[methodName.length - 1] + "-_{" + modifiedVariables[x] + "}->object{\"+JSON.stringify(" + modifiedVariables[x] + ")+\"}\"); " +
                        "}" +
                        "} catch (err){}";

                    if (parent.body instanceof Array) {
                        parent.body.splice(index + 1, 0, esprima.parse(xx).body[0]);
                    }
                } catch(err) {
                    console.log(err);
                }

/*                    var ii = 1;
                    while(ii<=scopeChain.length) {
                        if(scopeChain[scopeChain.length - ii].indexOf(modifiedVariables[x])>-1) break;
                        ii++;
                    }
                    if(ii<=scopeChain.length) {
                        if(methodName.length == 0) {
                            console.log('Method name is undefined');
                        }
                        xx = "try { if(typeof " + modifiedVariables[x] + " == 'number') {instrument_fs.appendFileSync('"+LOG_FILE+"', '..." + methodName[methodName.length-1] + "-_[" + modifiedVariables[x] + "]->['+" + modifiedVariables[x] + "+']'); } } catch (err){}";

                        if (parent.body instanceof Array) {
                            parent.body.splice(index + 1, 0, esprima.parse(xx).body[0]);
                        }

                        xx += "";
                        //var xx = "console.log('Changed Variable [" + modifiedVariables[x] + "] value ['+" + modifiedVariables[x] + "+']');";
                    }*/
                }
            }
            if(xx!="") {

            }
        }

        modifiedVariables=[];
        calledMethods=[];
    }
}
function methodSave(node, parent) {
    if (createsNewScope(node)) {
        var currentMethodName;
        currentMethodName = getCurrentMethodName(node, parent);
        methodName.push(methodNameDict[currentMethodName]);
        methodName.push(currentMethodName.substring(currentMethodName.lastIndexOf("/")));
    }
}

function replace(node, parent) {
    if (createsNewScope(node)){
        methodName.pop();
    } else if (node.type === util.astNodes.RETURN_STATEMENT){
        var tempVariable = esprima.parse(util.tempReturnVariable);
        tempVariable.body[0].declarations[0].init=node.argument;
        node.argument= util.returnTempVariable;

        xx = "try { " +
            "if(typeof tempReturnVar == 'number') {" +
            "instrument_fs.appendFileSync('" + LOG_FILE + "', \"..." + methodName[methodName.length - 1] + "-_{return_number}->{\"+tempReturnVar+\"}\"); " +
            "} else if(typeof tempReturnVar == 'string') {" +
            "instrument_fs.appendFileSync('" + LOG_FILE + "', \"..." + methodName[methodName.length - 1] + "-_{return_string}->{\"+tempReturnVar+\"}\"); " +
            "} else if(typeof tempReturnVar == 'boolean') {" +
            "instrument_fs.appendFileSync('" + LOG_FILE + "', \"..." + methodName[methodName.length - 1] + "-_{return_boolean}->{\"+tempReturnVar+\"}\"); " +
            "} else if(typeof tempReturnVar == 'object') {" +
            "instrument_fs.appendFileSync('" + LOG_FILE + "', \"..." + methodName[methodName.length - 1] + "-_{return_object}->{\"+JSON.stringify(tempReturnVar)+\"}\"); " +
            "} " +
            "} catch (err){}";
        return { type: 'BlockStatement', body: [tempVariable.body[0], esprima.parse(xx).body[0], node]};
    }
}

function createsNewScope(node){
    return node.type === util.astNodes.FUNCTION_DECLARATION ||
        node.type === util.astNodes.FUNCTION_EXPRESSION ||
        node.type === util.astNodes.PROGRAM;
}

function getCurrentMethodName(node, parent) {
    var currentMethodName = '';
    if (node.type === util.astNodes.FUNCTION_DECLARATION && node.id !== undefined) {
        currentMethodName = currentFileName + "->" + node.range + "->" + escodegen.generate(node.id);
    } else if (node.type === util.astNodes.FUNCTION_EXPRESSION) {
        if (parent.type == util.astNodes.ASSIGNMENT_EXPRESSION && parent.left !== undefined) {
            currentMethodName = currentFileName + "->" + node.range + "->" + escodegen.generate(parent.left);
        } else if (parent.type == util.astNodes.VARIABLE_DECLARATOR && parent.id !== undefined) {
            currentMethodName = currentFileName + "->" + node.range + "->" + escodegen.generate(parent.id);
        } else if (parent.type == util.astNodes.PROPERTY && parent.key !== undefined) {
            currentMethodName = currentFileName + "->" + node.range + "->" + escodegen.generate(parent.key);
        } else {
            currentMethodName = currentFileName + "->" + node.range;
        }
    } else {
        currentMethodName = currentFileName + "->" + node.range;
    }
    return currentMethodName;
}



Array.prototype.pushUnique = function (item){
    if(this.indexOf(item) == -1) {
        //if(jQuery.inArray(item, this) == -1) {
        this.push(item);
        return true;
    }
    return false;
}

