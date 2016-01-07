/**
 * Created by Pankajan on 08/12/2015.
 */
var fs = require('fs-extra');
var esprima = require('esprima');
var estraverse = require('estraverse');
var escodegen = require('escodegen');
var escope = require('escope');
var util = require('./lib/util');
var path = require('path');

var PERSONAL_HOME = '/Users/Pankajan/';
var OFFICE_HOME = '/afs/inf.ed.ac.uk/user/p/pchanthi/';
var PERSONAL_LAP = PERSONAL_HOME + 'Edinburgh/Research_Source/';
var OFFICE = OFFICE_HOME + 'edinburgh/research_source/';

var ROOT = PERSONAL_LAP;
var HOME = PERSONAL_HOME;
var PROJECT = 'd3';

var filename = ROOT + PROJECT;  //process.argv[2];
var outFilename = ROOT + "instrumented-" + PROJECT;  //process.argv[2];
var LOG_FILE = HOME + 'log_' + PROJECT + '.txt';

process(filename, outFilename);
var count=0;

function process(filename, outFilename) {
    var stat = fs.lstatSync(filename);
    if(stat.isDirectory()) {
        if(filename.indexOf('node_modules')==-1 && filename.indexOf('/test/')==-1) {
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
        //console.log("Processing File : " + filename);
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

var scopeManager;
var scopeChain;
var currentScope;

function instrument(filename) {

    var srcCode = fs.readFileSync(filename, 'utf-8');
    if (srcCode.charAt(0) === '#') { //shebang, 'comment' it out, won't affect syntax tree locations for things we care about
        srcCode = '//' + srcCode;
    }
        var error = 'ESPRIMA PARSE';
    var ast;
    try{
        ast = esprima.parse(srcCode, {
            loc: true,
            range: true,
            tokens: true,
            comment: true
        });
    } catch (notAScript) {
        ast = esprima.parse(srcCode, {
            loc: true,
            range: true,
            tokens: true,
            comment: true,
            sourceType: 'module'
        });
    }
        error = 'ESCOPE ANALYSIS';
        scopeManager = escope.analyze(ast);
        error = 'ESPRIMA ACQUIRE';
        currentScope = scopeManager.acquire(ast);   // global scope
        //console.log(JSON.stringify(ast));
        scopeChain = [];
        var currentScopeVariables = [];
        error = 'ESTRAVERSE TRAVERSE';
        estraverse.traverse(ast, {
            enter: enter,
            leave: leave
        });
        error = 'ESCODEGEN GENERATE';
        var newCode = escodegen.generate(ast);
        return newCode;
}


var modifiedVariables=[];
var calledMethods=[];
function enter(node, parent){
    //currentScope = scopeManager.acquire(node);
    //if(currentScope!=null) {
    //    currentScopeVariables = currentScope.variables;
    //}

    if (createsNewScope(node)){
        currentScope = scopeManager.acquire(node);
        scopeChain.push([]);
    } else if (node.type === util.astNodes.VARIABLE_DECLARATOR){
        scopeChain[scopeChain.length - 1].push(node.id.name);
    } else if (node.type === util.astNodes.ASSIGNMENT_EXPRESSION){
        var name = node.left.name;
        modifiedVariables.push(name);

        return node;
    } else if (node.type === util.astNodes.UPDATE_EXPRESSION) {
        //modifiedVariables.push(node.argument.name);
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

    } else if (node.type === util.astNodes.EXPRESSION_STATEMENT) {
        if(parent.body!=undefined && parent.body!=null) {
            var index=0;
            for(x=0; x<parent.body.length; x++) {
                if(parent.body[x].loc===node.loc) {
                    index=x;
                    break;
                }
            }

            var xx="";
            for (x = 0; x < modifiedVariables.length; x++) {
                if(modifiedVariables[x]!== undefined) {
                    if(modifiedVariables[x]==='touch') {
                        console.log('t');
                    }
                    var ii = 1;
                    while(ii<=scopeChain.length) {
                        if(scopeChain[scopeChain.length - ii].indexOf(modifiedVariables[x])>-1) break;
                        ii++;
                    }
                    if(ii<=scopeChain.length) {
                        xx = "if("+modifiedVariables[x]+") { require('fs').appendFile('"+LOG_FILE+"', '" + modifiedVariables[x] + "->'+" + modifiedVariables[x] + ");}";

                        if (parent.body instanceof Array) {
                            parent.body.splice(index + 1, 0, esprima.parse(xx));
                        }

                        /*if(currentScope!=null) {
                            var currentScopeVariables = currentScope.variables;
                            var contains = false;
                            for(i=0; i<currentScopeVariables.length; i++) {
                                if(currentScopeVariables[i].name===modifiedVariables[x]){
                                    contains = true;
                                    break;
                                }
                            }
                            if(true) {

                            }

                        }*/

                    }
                }
            }

        }

            for (x = 0; x < calledMethods.length; x++) {
                var xx = "console.log('Method called [" + calledMethods[x] + "]');";
                xx="";
                if(parent.body instanceof Array) {
                    parent.body.splice(index + 1, 0, esprima.parse(xx));
                }
            }

        modifiedVariables=[];
        calledMethods=[];
        }
}


function createsNewScope(node){
    return node.type === util.astNodes.FUNCTION_DECLARATION ||
        node.type === util.astNodes.FUNCTION_EXPRESSION ||
        node.type === util.astNodes.PROGRAM;
}

