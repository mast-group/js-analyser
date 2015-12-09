/**
 * Created by Pankajan on 08/12/2015.
 */
var fs = require('fs');
var esprima = require('esprima');
var estraverse = require('estraverse');
var escodegen = require('escodegen');
var escope = require('escope');
var util = require('./lib/util');

var filename = "test.js";  //process.argv[2];
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
/*var result = estraverse.replace(ast, {
    enter: replace
});*/
estraverse.traverse(ast, {
    enter: enter,
    leave: leave
});
var newCode = escodegen.generate(ast);
console.log(newCode);

function replace(node) {
    if(node.type === util.astNodes.FUNCTION_DECLARATION ||
        node.type === util.astNodes.FUNCTION_EXPRESSION ){
        var params = node.params;
        if(params!=undefined &&  node.body!=undefined && node.body.body!=undefined) {
            node.body.body.unshift(esprima.parse('start()'));
            return node;
        }
    }
}

var modifiedVariables=[];
function enter(node, parent){
    currentScope = scopeManager.acquire(node);
    if(currentScope!=null) {
        currentScopeVariables = currentScope.variables;
    }
    var curBody = node.body;
    modifiedVariables=[];
    if(curBody!=undefined) {
        estraverse.traverse(node, {
            enter: travelBodyNode
        });
    }
    for(x=0; x<modifiedVariables.length; x++){
        var xx = "console.log('Changed Variable ["+modifiedVariables[x]+"] value ['+"+modifiedVariables[x]+"+']');";
        node.body.body.unshift(esprima.parse(xx));
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
    }
    if (node.type === util.astNodes.VARIABLE_DECLARATOR){
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
        var xx = "console.log('Variable assignment ["+node.left.name+"] value ['+"+node.left.name+"+']');";
        //node.push(esprima.parse(xx));
        return node;
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
                var xx = "console.log('Method Parameter ["+params[i].name+"] value ['+"+params[i].name+"+']');";
                node.body.body.splice(node.body.body.length-1, 0, esprima.parse(xx));
            }
            return node;
        }
    } else if (node.type === util.astNodes.RETURN_STATEMENT){
        var tempVariable = esprima.parse(util.tempReturnVariable);
        tempVariable.body[0].declarations[0].init=node.argument;
        node.argument= util.returnTempVariable;
        var index = parent.body.length-1;
        if(index<0) index = 0;
        parent.body.splice(index, 0, tempVariable);
        return node;
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
