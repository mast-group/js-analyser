/**
 * Created by Pankajan on 08/12/2015.
 */
var fs = require('fs');
var esprima = require('esprima');
var estraverse = require('estraverse');
var escodegen = require('escodegen');
var escope = require('escope');
var util = require('./lib/util');

var filename = "/Users/Pankajan/Edinburgh/Research_Source/angular.js/src/apis.js";  //process.argv[2];
var srcCode = fs.readFileSync(filename);

var ast = esprima.parse(srcCode, {
    loc: true,
    range: true,
    tokens: true,
    comment: true
});
var scopeManager = escope.analyze(ast);

var currentScope = scopeManager.acquire(ast);   // global scope

//console.log(JSON.stringify(ast));
var scopeChain = [];
var currentScopeVariables=[];

estraverse.traverse(ast, {
    enter: enter,
    leave: leave
});

var result = estraverse.replace(ast, {
 leave: replace
 });

var newCode = escodegen.generate(result);
console.log(newCode);

function replace(node, parent) {
    if (node.type === util.astNodes.RETURN_STATEMENT){

        if(parent.body==null) {
            var tempVariable = esprima.parse(util.tempReturnVariable);
            tempVariable.body[0].declarations[0].init=node.argument;
            node.argument= util.returnTempVariable;

            var xx = "console.log('Return Value ['+tempReturnVar+']');";
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
function enter(node, parent){
    currentScope = scopeManager.acquire(node);
    if(currentScope!=null) {
        currentScopeVariables = currentScope.variables;
    }

    if (createsNewScope(node)){
        scopeChain.push([]);
        var params = node.params;

        if(params!=undefined) {
            for (i = 0; i < params.length; i++) {
                scopeChain[scopeChain.length - 1].push(params[i].name);
                var xx = "console.log('Method Parameter ["+params[i].name+"] value ['+"+params[i].name+"+']');";
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
    } else if (node.type === util.astNodes.EXPRESSION_STATEMENT) {
        modifiedVariables=[];
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
                scopeChain[scopeChain.length - 1].push(params[i].name);
                var xx = "console.log('Method Parameter Method End ["+params[i].name+"] value ['+"+params[i].name+"+']');";
                node.body.body.splice(node.body.body.length-1, 0, esprima.parse(xx));
            }
            return node;
        }
    } else if (node.type === util.astNodes.RETURN_STATEMENT){

        if (parent.body != null) {
            var tempVariable = esprima.parse(util.tempReturnVariable);
            tempVariable.body[0].declarations[0].init=node.argument;
            node.argument= util.returnTempVariable;

            var xx = "console.log('Return Value ['+tempReturnVar+']');";
            var index = parent.body.length - 1;
            if (index < 0) index = 0;
            //parent.body.splice(index, 0, esprima.parse(xx));
            parent.body.splice(index, 0, tempVariable);
        }
    } else if (node.type === util.astNodes.EXPRESSION_STATEMENT) {
        if(parent.body!=undefined && parent.body!=null) {
            var index=0;
            for(x=0; x<parent.body.length; x++) {
                if(parent.body[x].loc===node.loc) {
                    index=x;
                    break;
                }
            }
            for (x = 0; x < modifiedVariables.length; x++) {
                var xx = "console.log('Changed Variable [" + modifiedVariables[x] + "] value ['+" + modifiedVariables[x] + "+']');";
                parent.body.splice(index+1, 0, esprima.parse(xx));
            }
        }
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
