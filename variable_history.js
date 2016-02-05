/**
 * Created by Pankajan on 08/12/2015.
 */
var fs = require('fs-extra');
var esprima = require('esprima');
var estraverse = require('estraverse');
var escodegen = require('escodegen');
var util = require('./lib/util');
var path = require('path');

var PERSONAL_HOME = '/Users/Pankajan/';
var OFFICE_HOME = '/afs/inf.ed.ac.uk/user/p/pchanthi/';
var PERSONAL = PERSONAL_HOME + 'Edinburgh/Research_Source/';
var OFFICE = OFFICE_HOME + 'edinburgh/research_source/';

var LESS = "less.js";
var D3 = "d3";
var EXPRESS = "express";
var MOMENT = "moment";
var METEOR = "meteor";

var ROOT = PERSONAL;
var HOME = PERSONAL_HOME;
var PROJECT = "lodash";

var filename = ROOT + "Original/" + PROJECT;  //process.argv[2];
var outFilename = ROOT + "Instrumented/" + PROJECT;  //process.argv[2];
var LOG_FILE = ROOT + "Result/" + 'log_' + PROJECT + '.txt';

process(filename, outFilename);

function process(filename, outFilename) {
    var stat = fs.lstatSync(filename);
    if(stat.isDirectory()) {
        if(filename.indexOf('node_modules')==-1 && filename.indexOf('/test')==-1 && filename.indexOf('__tests__')==-1) {
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
    estraverse.traverse(ast, {
        enter: enter,
        leave: leave
    });

   /* var result = estraverse.replace(ast, {
        leave: replace
    });*/

    return escodegen.generate(ast);
}

var scopeChain = [];
var modifiedVariables=[];
var calledMethods=[];

var methodName = [];

function enter(node, parent) {
    if (createsNewScope(node)){
        if(node.type === util.astNodes.FUNCTION_DECLARATION && node.id!== undefined && node.id.name != undefined) {
            methodName.push(currentFileName + "->" + node.range + "->" + node.id.name);
        } else if (node.type === util.astNodes.FUNCTION_EXPRESSION) {
            if(parent.type == util.astNodes.ASSIGNMENT_EXPRESSION && parent.left !== undefined && parent.left.name !== undefined) {
                methodName.push(currentFileName + "->" + node.range + "->" + parent.left.name);
            } else if (parent.type == util.astNodes.VARIABLE_DECLARATOR && parent.id !== undefined && parent.id.name !== undefined) {
                methodName.push(currentFileName + "->" + node.range + "->" + parent.id.name);
            } else {
                methodName.push(currentFileName + "->" + node.range);
            }
        } else {
            methodName.push(currentFileName + "->" + node.range);
        }

        var xx = "try { var instrument_fs = require('fs'); instrument_fs.appendFileSync('"+LOG_FILE+"', '>>>" + methodName[methodName.length-1] + "');} catch (err){}";
        if(node.body!=undefined && node.body.body != undefined && node.body.body instanceof Array)
        node.body.body.unshift(esprima.parse(xx));
        scopeChain.push([]);
        var params = node.params;

        if(params!=undefined) {
            for (i = 0; i < params.length; i++) {
                scopeChain[scopeChain.length - 1].push(params[i].name);
            }
        }
    } else if (node.type === util.astNodes.VARIABLE_DECLARATOR){
        scopeChain[scopeChain.length - 1].push(node.id.name);
    } else if (node.type === util.astNodes.ASSIGNMENT_EXPRESSION){
        var name = node.left.name;
        modifiedVariables.push(name);
    } else if (node.type === util.astNodes.UPDATE_EXPRESSION) {
        modifiedVariables.push(node.argument.name);
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
                if(modifiedVariables[x]!== undefined) {
                    var ii = 1;
                    while(ii<=scopeChain.length) {
                        if(scopeChain[scopeChain.length - ii].indexOf(modifiedVariables[x])>-1) break;
                        ii++;
                    }
                    if(ii<=scopeChain.length) {
                        if(methodName.length == 0) {
                            console.log('Method name is undefined');
                        }
                        xx = "try { if(typeof " + modifiedVariables[x] + " == 'number') { var instrument_fs = require('fs'); instrument_fs.appendFileSync('"+LOG_FILE+"', '..." + methodName[methodName.length-1] + "-_-_-_-Changed Variable [" + modifiedVariables[x] + "] value ['+" + modifiedVariables[x] + "+']'); } } catch (err){}";

                        if (parent.body instanceof Array) {
                            parent.body.splice(index + 1, 0, esprima.parse(xx));
                        }

                        xx += "";
                        //var xx = "console.log('Changed Variable [" + modifiedVariables[x] + "] value ['+" + modifiedVariables[x] + "+']');";
                    }
                }
            }
            if(xx!="") {

            }
        }

        modifiedVariables=[];
        calledMethods=[];
    }
}

function replace(node, parent) {
    if (node.type === util.astNodes.RETURN_STATEMENT){
/*
        if(parent.body==null) {
            var tempVariable = esprima.parse(util.tempReturnVariable);
            tempVariable.body[0].declarations[0].init=node.argument;
            node.argument= util.returnTempVariable;

            var xx = "console.log('Return Value ['+tempReturnVar+']');";
            xx="";
            var newNode = util.returnTempBlock;
            newNode.body[0] = tempVariable;
            //newNode.body[1] = esprima.parse(xx);
            newNode.body[1] = node;
            return newNode;
        } else {

        }*/
    }
}

function createsNewScope(node){
    return node.type === util.astNodes.FUNCTION_DECLARATION ||
        node.type === util.astNodes.FUNCTION_EXPRESSION ||
        node.type === util.astNodes.PROGRAM;
}


