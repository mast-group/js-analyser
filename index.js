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


var LOG_FILE = '/Users/Pankajan/Edinburgh/log.txt';
var filename = "/Users/Pankajan/Edinburgh/Research_Source/d3";  //process.argv[2];
var outFilename = "/Users/Pankajan/Edinburgh/Research_Source/instrumented-d3";  //process.argv[2];


// var filename = "/afs/inf.ed.ac.uk/user/p/pchanthi/edinburgh/research_source/d3";  //process.argv[2];
//var outFilename = "/afs/inf.ed.ac.uk/user/p/pchanthi/edinburgh/research_source/instrumented-d3";  //process.argv[2];
process(filename, outFilename);
var count=0;

function process(filename, outFilename) {
    var stat = fs.lstatSync(filename);
    if(stat.isDirectory()) {
        if(filename.indexOf('node_modules')==-1) {
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
        //scopeManager = escope.analyze(ast);
        error = 'ESPRIMA ACQUIRE';
        //var currentScope = scopeManager.acquire(ast);   // global scope
        //console.log(JSON.stringify(ast));
        scopeChain = [];
        var currentScopeVariables = [];
        error = 'ESTRAVERSE TRAVERSE';
        estraverse.traverse(ast, {
            enter: enter,
            leave: leave
        });
        error = 'ESTRAVERSE REPLACE';
        var result = estraverse.replace(ast, {
            leave: replace
        });
        error = 'ESCODEGEN GENERATE';
        var newCode = escodegen.generate(result);
        return newCode;
}


function replace(node, parent) {
    if (node.type === util.astNodes.RETURN_STATEMENT){

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

        }
    }
}

var modifiedVariables=[];
var calledMethods=[];
function enter(node, parent){
    //currentScope = scopeManager.acquire(node);
    //if(currentScope!=null) {
    //    currentScopeVariables = currentScope.variables;
    //}

    if (createsNewScope(node)){
        scopeChain.push([]);
        var params = node.params;

        if(params!=undefined) {
            for (i = 0; i < params.length; i++) {
                scopeChain[scopeChain.length - 1].push(params[i].name);
                var xx = "console.log('Method Parameter ["+params[i].name+"] value ['+"+params[i].name+"+']');";
                xx="";
                node.body.body.unshift(esprima.parse(xx));
            }
            return node;
        }
    } else if (node.type === util.astNodes.VARIABLE_DECLARATOR){
        scopeChain[scopeChain.length - 1].push(node.id.name);
    } else if (node.type === util.astNodes.ASSIGNMENT_EXPRESSION){
        var name = node.left.name;
        var index = 1;
        while(index<=scopeChain.length) {
            var currentScope = scopeChain[scopeChain.length - index];
            if(currentScope[name]!= undefined) break;
            if(index===scopeChain.length) currentScope.push(name);
            index++;
        }
        //var xx = "console.log('Variable assignment ["+node.left.name+"] value ['+"+node.left.name+"+']');";
        //node.push(esprima.parse(xx));
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
function travelBodyNode(node, parent) {
    if (node.type === util.astNodes.ASSIGNMENT_EXPRESSION){
        modifiedVariables.push(node.left.name);
    }
}

function leave(node, parent){
    if (createsNewScope(node)){
        var currentScope = scopeChain.pop();
        var params = node.params;
        if(params!=undefined) {
            for (i = 0; i < params.length; i++) {
                //scopeChain[scopeChain.length - 1].push(params[i].name);
                var xx = "console.log('Method Parameter Method End ["+params[i].name+"] value ['+"+params[i].name+"+']');";
                xx="";
                node.body.body.splice(node.body.body.length-1, 0, esprima.parse(xx));
            }
            return node;
        }
    } /*else if (node.type === util.astNodes.RETURN_STATEMENT){

        if (parent.body != null) {
            var tempVariable = esprima.parse(util.tempReturnVariable);
            tempVariable.body[0].declarations[0].init=node.argument;
            node.argument= util.returnTempVariable;

            var xx = "console.log('Return Value ['+tempReturnVar+']');";
            xx="";
            var index = parent.body.length - 1;
            if (index < 0) index = 0;
            //parent.body.splice(index, 0, esprima.parse(xx));
            if(parent.body instanceof Array) {
                parent.body.splice(index, 0, tempVariable);
            }
        }
    } */else if (node.type === util.astNodes.EXPRESSION_STATEMENT) {
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
                    var ii = 1;
                    while(ii<=scopeChain.length) {
                        if(scopeChain[scopeChain.length - ii].indexOf(modifiedVariables[x])>-1) break;
                        ii++;
                    }
                    if(ii<=scopeChain.length) {
                        xx += "...Changed Variable [" + modifiedVariables[x] + "] value ['+" + modifiedVariables[x] + "+']";
                        //var xx = "console.log('Changed Variable [" + modifiedVariables[x] + "] value ['+" + modifiedVariables[x] + "+']');";
                    }
                }
            }
            if(xx!="") {
                xx = "require('fs').appendFile('"+LOG_FILE+"', '" + xx + "');";

                if (parent.body instanceof Array) {
                    parent.body.splice(index + 1, 0, esprima.parse(xx));
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

function printScope(scope, node){
    var varsDisplay = scope.join(', ');
    if (node.type === util.astNodes.PROGRAM){
        console.log('Variables declared in the global scope:',
            varsDisplay);
    }else{
        if (node.id && node.id.name){
            console.log('Variables declared in the function ' + node.id.name + '():',
                varsDisplay);
        }else{
            console.log('Variables declared in anonymous function:',
                varsDisplay);
        }
    }
}

function createsNewScope(node){
    return node.type === util.astNodes.FUNCTION_DECLARATION ||
        node.type === util.astNodes.FUNCTION_EXPRESSION ||
        node.type === util.astNodes.PROGRAM;
}


/*
var globalScope = escope.analyze(ast).scopes[0];

globalScope.implicit.variables.forEach(function(v) {
    var id = v.identifiers[0];
    console.warn('"' + id.name + '" used at line : ' + id.loc.start.line + ' was not declared');
});
*/
